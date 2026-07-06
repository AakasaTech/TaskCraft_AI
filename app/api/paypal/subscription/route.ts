import https from 'node:https';
import { createClient } from '@/lib/supabase/server';
import type { Plan } from '@/lib/types';

export const runtime = 'nodejs';

const VALID_PLANS: Plan[] = ['solo', 'team'];

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

async function getSubscription(subscriptionId: string, token: string): Promise<{ status: string; plan_id: string } | null> {
  const apiBase = process.env.PAYPAL_API_URL ?? 'https://api-m.paypal.com';
  const url     = new URL(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, apiBase);

  return new Promise((resolve) => {
    const req = https.request(
      { hostname: url.hostname, path: url.pathname, method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(null); }
      }); },
    );
    req.on('error', () => resolve(null)); req.end();
  });
}

const PLAN_ID_PLAN_MAP: Record<string, Plan> = {
  [process.env.PAYPAL_PLAN_ID_SOLO_MONTHLY  ?? '__none__']: 'solo',
  [process.env.PAYPAL_PLAN_ID_SOLO_YEARLY   ?? '__none__']: 'solo',
  [process.env.PAYPAL_PLAN_ID_TEAM_MONTHLY  ?? '__none__']: 'team',
  [process.env.PAYPAL_PLAN_ID_TEAM_YEARLY   ?? '__none__']: 'team',
};

export async function POST(req: Request) {
  try {
    const { subscriptionID, planKey } = (await req.json()) as { subscriptionID: string; planKey: Plan };

    if (!subscriptionID || !planKey) {
      return Response.json({ error: 'Missing subscriptionID or planKey' }, { status: 400 });
    }

    if (!VALID_PLANS.includes(planKey)) {
      return Response.json({ error: 'Invalid planKey' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify the subscription with PayPal before storing it
    const paypalPlansConfigured = !!(
      process.env.PAYPAL_PLAN_ID_SOLO_MONTHLY || process.env.PAYPAL_PLAN_ID_TEAM_MONTHLY
    );

    if (paypalPlansConfigured) {
      try {
        const token = await getAccessToken();
        const sub   = await getSubscription(subscriptionID, token);

        if (!sub) {
          return Response.json({ error: 'Could not verify subscription with PayPal' }, { status: 400 });
        }

        // Verify subscription is in a valid state (APPROVAL_PENDING before capture, ACTIVE after)
        const validStatuses = ['APPROVAL_PENDING', 'APPROVED', 'ACTIVE'];
        if (!validStatuses.includes(sub.status?.toUpperCase())) {
          console.error('[paypal/subscription] invalid status:', sub.status);
          return Response.json({ error: 'Subscription is not active' }, { status: 400 });
        }

        // Verify the plan_id matches the claimed planKey
        const resolvedPlan = PLAN_ID_PLAN_MAP[sub.plan_id];
        if (resolvedPlan && resolvedPlan !== planKey) {
          console.error('[paypal/subscription] plan mismatch', sub.plan_id, planKey);
          return Response.json({ error: 'Plan mismatch' }, { status: 400 });
        }
      } catch (verifyErr) {
        // Log but don't block — PayPal webhook will confirm asynchronously
        console.error('[paypal/subscription] verification warning:', verifyErr);
      }
    }

    // Upsert subscription record
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from('subscriptions').update({
          plan_id:                planKey,
          status:                 'trialing',
          paypal_subscription_id: subscriptionID,
          updated_at:             new Date().toISOString(),
        }).eq('id', existing.id)
      : await supabase.from('subscriptions').insert({
          user_id:                user.id,
          plan_id:                planKey,
          status:                 'trialing',
          paypal_subscription_id: subscriptionID,
        });

    if (error) {
      console.error('[paypal/subscription] upsert error:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[paypal/subscription] unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
