// PayPal server-side webhook handler.
// Verifies the signature with PayPal's API, then updates subscription status.
// Register this URL in PayPal Developer Console:
//   https://<domain>/api/paypal/webhook
// Required events: BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED,
//                  BILLING.SUBSCRIPTION.SUSPENDED, BILLING.SUBSCRIPTION.EXPIRED,
//                  PAYMENT.SALE.COMPLETED

import https from 'node:https';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// ── PayPal access token ───────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const clientId     = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? '';
  const apiBase      = process.env.PAYPAL_API_URL ?? 'https://api-m.paypal.com';
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const body = 'grant_type=client_credentials';
    const url  = new URL('/v1/oauth2/token', apiBase);
    const req  = https.request(
      { hostname: url.hostname, path: url.pathname, method: 'POST',
        headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => {
        try { const j = JSON.parse(d); j.access_token ? resolve(j.access_token) : reject(new Error('No access_token')); }
        catch { reject(new Error('Bad JSON from PayPal auth')); }
      }); },
    );
    req.on('error', reject); req.write(body); req.end();
  });
}

// ── Webhook signature verification ───────────────────────────────────────────

async function verifyWebhookSignature(
  headers: Headers,
  body: string,
  token: string,
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID ?? '';
  if (!webhookId) {
    console.warn('[paypal/webhook] PAYPAL_WEBHOOK_ID not set; skipping verification in dev');
    return process.env.NODE_ENV !== 'production';
  }

  const payload = JSON.stringify({
    auth_algo:         headers.get('paypal-auth-algo') ?? '',
    cert_url:          headers.get('paypal-cert-url') ?? '',
    transmission_id:   headers.get('paypal-transmission-id') ?? '',
    transmission_sig:  headers.get('paypal-transmission-sig') ?? '',
    transmission_time: headers.get('paypal-transmission-time') ?? '',
    webhook_id:        webhookId,
    webhook_event:     JSON.parse(body),
  });

  const apiBase = process.env.PAYPAL_API_URL ?? 'https://api-m.paypal.com';
  const url     = new URL('/v1/notifications/verify-webhook-signature', apiBase);

  return new Promise((resolve) => {
    const req = https.request(
      { hostname: url.hostname, path: url.pathname, method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => {
        try { const j = JSON.parse(d); resolve(j.verification_status === 'SUCCESS'); }
        catch { resolve(false); }
      }); },
    );
    req.on('error', () => resolve(false)); req.write(payload); req.end();
  });
}

// ── Plan mapping ──────────────────────────────────────────────────────────────

const PLAN_ID_MAP: Record<string, string> = {
  [process.env.PAYPAL_PLAN_ID_SOLO_MONTHLY  ?? '__none__']: 'solo',
  [process.env.PAYPAL_PLAN_ID_SOLO_YEARLY   ?? '__none__']: 'solo',
  [process.env.PAYPAL_PLAN_ID_TEAM_MONTHLY  ?? '__none__']: 'team',
  [process.env.PAYPAL_PLAN_ID_TEAM_YEARLY   ?? '__none__']: 'team',
};

function planFromPayPalPlanId(planId: string): string | null {
  return PLAN_ID_MAP[planId] ?? null;
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const rawBody = await req.text();

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Verify signature (skip in dev if webhook ID not configured)
  try {
    const token  = await getAccessToken();
    const valid  = await verifyWebhookSignature(req.headers, rawBody, token);
    if (!valid) {
      console.error('[paypal/webhook] signature verification failed');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } catch (err) {
    console.error('[paypal/webhook] verification error:', err);
    return Response.json({ error: 'Verification error' }, { status: 500 });
  }

  const eventType = (event.event_type as string) ?? '';
  const resource  = (event.resource ?? {}) as Record<string, unknown>;
  const subId     = (resource.id as string) ?? '';

  console.log('[paypal/webhook]', eventType, subId);

  const admin = createAdminClient();

  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'PAYMENT.SALE.COMPLETED': {
      const planId = (resource.plan_id as string) ?? '';
      const plan   = planFromPayPalPlanId(planId);

      await admin
        .from('subscriptions')
        .update({
          status:               'active',
          ...(plan ? { plan_id: plan } : {}),
          current_period_start: new Date().toISOString(),
        })
        .eq('paypal_subscription_id', subId);
      break;
    }

    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED': {
      await admin
        .from('subscriptions')
        .update({ status: eventType.includes('CANCELLED') ? 'cancelled' : 'expired', cancelled_at: new Date().toISOString() })
        .eq('paypal_subscription_id', subId);
      break;
    }

    case 'BILLING.SUBSCRIPTION.SUSPENDED': {
      await admin
        .from('subscriptions')
        .update({ status: 'past_due' })
        .eq('paypal_subscription_id', subId);
      break;
    }

    default:
      // Unhandled event types are silently acknowledged
      break;
  }

  return Response.json({ ok: true });
}
