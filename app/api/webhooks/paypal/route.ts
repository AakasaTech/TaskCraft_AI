import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

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

  try {
    // ── BILLING.SUBSCRIPTION.ACTIVATED ─────────────────────────────
    // Fires when subscription becomes active (start of trial or immediate activation).
    // next_billing_time = trial end date (first payment date).
    if (event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const planId      = resource?.plan_id as string | undefined;
      const userId       = resource?.custom_id as string | undefined;
      const subId        = resource?.id as string | undefined;
      const plan         = planId ? PLAN_MAP[planId] : undefined;
      const expiresAtStr = (resource?.billing_info as Record<string, unknown> | undefined)?.next_billing_time as string | undefined;
      const expiresAt    = expiresAtStr ? new Date(expiresAtStr) : null;

      if (userId && plan) {
        await prisma.profile.updateMany({
          where: { userId },
          data:  { plan, planExpiresAt: expiresAt },
        });
      }

      if (subId && expiresAt) {
        await prisma.subscription.updateMany({
          where: { paypalSubscriptionId: subId },
          data:  { status: 'trialing', trialEndsAt: expiresAt, currentPeriodEnd: expiresAt },
        });
      }
    }

    // ── BILLING.SUBSCRIPTION.RENEWED ───────────────────────────────
    // Fires when a billing cycle completes and a new one starts (trial end → first charge,
    // or each subsequent monthly/yearly renewal).
    if (event_type === 'BILLING.SUBSCRIPTION.RENEWED') {
      const planId       = resource?.plan_id as string | undefined;
      const userId        = resource?.custom_id as string | undefined;
      const subId         = resource?.id as string | undefined;
      const plan          = planId ? PLAN_MAP[planId] : undefined;
      const expiresAtStr  = (resource?.billing_info as Record<string, unknown> | undefined)?.next_billing_time as string | undefined;
      const expiresAt     = expiresAtStr ? new Date(expiresAtStr) : null;

      if (userId && plan) {
        await prisma.profile.updateMany({
          where: { userId },
          data:  { plan, planExpiresAt: expiresAt },
        });
      }

      if (subId) {
        await prisma.subscription.updateMany({
          where: { paypalSubscriptionId: subId },
          data: {
            status:             'active',
            currentPeriodEnd:   expiresAt,
            currentPeriodStart: new Date(),
          },
        });
      }
    }

    // ── BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED ─────────────────────
    // Fires on each successful charge. Marks the subscription as active
    // (covers the case where RENEWED isn't fired on the first charge).
    if (event_type === 'BILLING.SUBSCRIPTION.PAYMENT.SUCCEEDED') {
      const subId = resource?.id as string | undefined;
      if (subId) {
        await prisma.subscription.updateMany({
          where: { paypalSubscriptionId: subId, status: 'trialing' }, // only transition from trialing → active
          data:  { status: 'active' },
        });
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
        await prisma.profile.updateMany({
          where: { userId },
          data:  { plan: 'free', planExpiresAt: null },
        });
      }

      if (subId) {
        await prisma.subscription.updateMany({
          where: { paypalSubscriptionId: subId },
          data: {
            status:      event_type === 'BILLING.SUBSCRIPTION.EXPIRED' ? 'expired' : 'cancelled',
            cancelledAt: new Date(),
          },
        });
      }
    }

    // ── BILLING.SUBSCRIPTION.SUSPENDED ─────────────────────────────
    // Fires when payment fails and subscription is suspended (past_due).
    if (event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      const subId = resource?.id as string | undefined;
      if (subId) {
        await prisma.subscription.updateMany({
          where: { paypalSubscriptionId: subId },
          data:  { status: 'past_due' },
        });
      }
    }
  } catch (err) {
    console.error('PayPal webhook error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
