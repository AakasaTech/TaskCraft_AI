import { createHmac, randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WebhookEventType } from '@/lib/types';

export { WebhookEventType };

const DELIVERY_TIMEOUT_MS = 10_000;

interface WebhookPayload {
  id:         string;
  event:      WebhookEventType;
  created_at: string;
  data:       Record<string, unknown>;
}

async function sendToEndpoint(
  url:    string,
  secret: string,
  body:   string,
  event:  WebhookEventType,
): Promise<{ statusCode: number | null; response: string | null; error: string | null }> {
  const sig = createHmac('sha256', secret).update(body).digest('hex');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':           'application/json',
        'X-TaskCraft-Signature':  `sha256=${sig}`,
        'X-TaskCraft-Event':      event,
        'X-TaskCraft-Delivery':   randomUUID(),
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    return {
      statusCode: res.status,
      response:   (await res.text().catch(() => '')).slice(0, 2000),
      error:      null,
    };
  } catch (err) {
    return {
      statusCode: null,
      response:   null,
      error:      err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function deliverWebhookEvent(params: {
  workspaceId: string;
  event:       WebhookEventType;
  data:        Record<string, unknown>;
}) {
  const admin = createAdminClient();

  const { data: webhooks } = await admin
    .from('webhooks')
    .select('id, url, secret')
    .eq('workspace_id', params.workspaceId)
    .eq('active', true)
    .contains('events', [params.event]);

  if (!webhooks?.length) return;

  const envelope: WebhookPayload = {
    id:         randomUUID(),
    event:      params.event,
    created_at: new Date().toISOString(),
    data:       params.data,
  };
  const body = JSON.stringify(envelope);

  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const { statusCode, response, error } = await sendToEndpoint(wh.url, wh.secret, body, params.event);

      const now = new Date().toISOString();
      await Promise.all([
        admin.from('webhook_deliveries').insert({
          webhook_id:   wh.id,
          event:        params.event,
          payload:      envelope,
          status_code:  statusCode,
          response,
          error,
          delivered_at: statusCode ? now : null,
        }),
        // Update last_fired_at on the webhook
        admin.from('webhooks').update({ last_fired_at: now }).eq('id', wh.id),
      ]);
    }),
  );
}

export async function sendTestWebhook(params: {
  url:    string;
  secret: string;
  event:  WebhookEventType;
}): Promise<{ ok: boolean; statusCode: number | null; error: string | null }> {
  const body = JSON.stringify({
    id:         randomUUID(),
    event:      params.event,
    created_at: new Date().toISOString(),
    data:       { test: true, message: 'This is a test delivery from TaskCraft AI.' },
  });

  const { statusCode, error } = await sendToEndpoint(params.url, params.secret, body, params.event);
  return {
    ok:         statusCode !== null && statusCode >= 200 && statusCode < 300,
    statusCode,
    error,
  };
}
