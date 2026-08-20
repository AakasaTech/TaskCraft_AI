import https from 'node:https';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth/helpers';

export const runtime = 'nodejs';

async function getPayPalAccessToken(): Promise<string> {
  const clientId     = process.env.PAYPAL_CLIENT_ID ?? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? '';
  const apiBase      = process.env.PAYPAL_API_URL ?? 'https://api-m.paypal.com';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const body = 'grant_type=client_credentials';
    const url  = new URL('/v1/oauth2/token', apiBase);

    const req = https.request(
      {
        hostname: url.hostname,
        path:     url.pathname,
        method:   'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) resolve(json.access_token);
            else reject(new Error('No access token'));
          } catch { reject(new Error('Bad JSON from PayPal auth')); }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function cancelPayPalSubscription(subscriptionID: string, token: string): Promise<void> {
  const apiBase = process.env.PAYPAL_API_URL ?? 'https://api-m.paypal.com';
  const body    = JSON.stringify({ reason: 'Customer requested cancellation' });
  const url     = new URL(`/v1/billing/subscriptions/${subscriptionID}/cancel`, apiBase);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path:     url.pathname,
        method:   'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        // 204 = success, no body
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve();
        } else {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => reject(new Error(`PayPal cancel returned ${res.statusCode}: ${data}`)));
        }
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function POST(req: Request) {
  try {
    const { subscriptionID } = (await req.json()) as { subscriptionID: string };
    if (!subscriptionID) return Response.json({ error: 'Missing subscriptionID' }, { status: 400 });

    const user = await getAuthUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify this subscription belongs to the user
    const sub = await prisma.subscription.findFirst({
      where: { userId: user.id, paypalSubscriptionId: subscriptionID },
      select: { id: true },
    });

    if (!sub) return Response.json({ error: 'Subscription not found' }, { status: 404 });

    // Cancel via PayPal API
    const token = await getPayPalAccessToken();
    await cancelPayPalSubscription(subscriptionID, token);

    // Mark as cancelled locally — webhook will also fire but this gives immediate feedback
    await prisma.subscription.updateMany({
      where: { paypalSubscriptionId: subscriptionID },
      data:  { status: 'cancelled', cancelledAt: new Date() },
    });

    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[paypal/cancel]', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
