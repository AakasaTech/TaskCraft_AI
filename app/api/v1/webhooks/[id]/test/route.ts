import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { sendTestWebhook } from '@/lib/webhooks';
import type { WebhookEventType } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'admin')) return apiError('FORBIDDEN', 'Admin scope required.', 403);

  const { data: webhook } = await createAdminClient()
    .from('webhooks')
    .select('url, secret, events')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!webhook) return apiError('NOT_FOUND', 'Webhook not found.', 404);

  const body  = await req.json().catch(() => ({}));
  const event = (body.event ?? webhook.events[0]) as WebhookEventType;

  const result = await sendTestWebhook({ url: webhook.url, secret: webhook.secret, event });

  return apiSuccess({
    event,
    ok:          result.ok,
    status_code: result.statusCode,
    error:       result.error,
  });
}
