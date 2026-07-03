import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const PLAN_MAP: Record<string, 'solo' | 'team'> = {
  [process.env.PAYPAL_PLAN_ID_SOLO_MONTHLY  ?? '']: 'solo',
  [process.env.PAYPAL_PLAN_ID_SOLO_YEARLY   ?? '']: 'solo',
  [process.env.PAYPAL_PLAN_ID_TEAM_MONTHLY  ?? '']: 'team',
  [process.env.PAYPAL_PLAN_ID_TEAM_YEARLY   ?? '']: 'team',
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { event_type, resource } = body;

  const supabase = createAdminClient();

  try {
    if (event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const planId = resource?.plan_id;
      const userId = resource?.custom_id;
      const plan = PLAN_MAP[planId];
      const expiresAt = resource?.billing_info?.next_billing_time;

      if (userId && plan) {
        await supabase
          .from('profiles')
          .update({ plan, plan_expires_at: expiresAt ?? null })
          .eq('id', userId);
      }
    }

    if (event_type === 'BILLING.SUBSCRIPTION.CANCELLED' || event_type === 'BILLING.SUBSCRIPTION.EXPIRED') {
      const userId = resource?.custom_id;
      if (userId) {
        await supabase
          .from('profiles')
          .update({ plan: 'free', plan_expires_at: null })
          .eq('id', userId);
      }
    }

    if (event_type === 'BILLING.SUBSCRIPTION.RENEWED') {
      const planId = resource?.plan_id;
      const userId = resource?.custom_id;
      const plan = PLAN_MAP[planId];
      const expiresAt = resource?.billing_info?.next_billing_time;

      if (userId && plan) {
        await supabase
          .from('profiles')
          .update({ plan, plan_expires_at: expiresAt ?? null })
          .eq('id', userId);
      }
    }
  } catch (err) {
    console.error('PayPal webhook error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
