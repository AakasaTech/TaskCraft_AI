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
  const { event_type, resource } = body as {
    event_type: string;
    resource: Record<string, unknown>;
  };

  const supabase = createAdminClient();

  try {
    // ── BILLING.SUBSCRIPTION.ACTIVATED ─────────────────────────────
    // Fires when subscription becomes active (start of trial or immediate activation).
    // next_billing_time = trial end date (first payment date).
    if (event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const planId      = resource?.plan_id as string | undefined;
      const userId      = resource?.custom_id as string | undefined;
      const subId       = resource?.id as string | undefined;
      const plan        = planId ? PLAN_MAP[planId] : undefined;
      const expiresAt   = (resource?.billing_info as Record<string, unknown> | undefined)?.next_billing_time as string | undefined;

      if (userId && plan) {
        await supabase
          .from('profiles')
          .update({ plan, plan_expires_at: expiresAt ?? null })
          .eq('id', userId);
      }

      if (subId && expiresAt) {
        await supabase
          .from('subscriptions')
          .update({ status: 'trialing', trial_ends_at: expiresAt, current_period_end: expiresAt })
          .eq('paypal_subscription_id', subId);
      }
    }

    // ── BILLING.SUBSCRIPTION.RENEWED ───────────────────────────────
    // Fires when a billing cycle completes and a new one starts (trial end → first charge,
    // or each subsequent monthly/yearly renewal).
    if (event_type === 'BILLING.SUBSCRIPTION.RENEWED') {
      const planId    = resource?.plan_id as string | undefined;
      const userId    = resource?.custom_id as string | undefined;
      const subId     = resource?.id as string | undefined;
      const plan      = planId ? PLAN_MAP[planId] : undefined;
      const expiresAt = (resource?.billing_info as Record<string, unknown> | undefined)?.next_billing_time as string | undefined;

      if (userId && plan) {
        await supabase
          .from('profiles')
          .update({ plan, plan_expires_at: expiresAt ?? null })
          .eq('id', userId);
      }

      if (subId) {
        await supabase
          .from('subscriptions')
          .update({
            status:               'active',
            current_period_end:   expiresAt ?? null,
            current_period_start: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', subId);
      }
    }

    // ── BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED ─────────────────────
    // Fires on each successful charge. Marks the subscription as active
    // (covers the case where RENEWED isn't fired on the first charge).
    if (event_type === 'BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED') {
      const subId = resource?.id as string | undefined;
      if (subId) {
        await supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('paypal_subscription_id', subId)
          .eq('status', 'trialing'); // only transition from trialing → active
      }
    }

    // ── BILLING.SUBSCRIPTION.CANCELLED / EXPIRED ───────────────────
    if (
      event_type === 'BILLING.SUBSCRIPTION.CANCELLED' ||
      event_type === 'BILLING.SUBSCRIPTION.EXPIRED'
    ) {
      const userId = resource?.custom_id as string | undefined;
      const subId  = resource?.id as string | undefined;

      if (userId) {
        await supabase
          .from('profiles')
          .update({ plan: 'free', plan_expires_at: null })
          .eq('id', userId);
      }

      if (subId) {
        await supabase
          .from('subscriptions')
          .update({
            status:       event_type === 'BILLING.SUBSCRIPTION.EXPIRED' ? 'expired' : 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('paypal_subscription_id', subId);
      }
    }

    // ── BILLING.SUBSCRIPTION.SUSPENDED ─────────────────────────────
    // Fires when payment fails and subscription is suspended (past_due).
    if (event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      const subId = resource?.id as string | undefined;
      if (subId) {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('paypal_subscription_id', subId);
      }
    }
  } catch (err) {
    console.error('PayPal webhook error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
