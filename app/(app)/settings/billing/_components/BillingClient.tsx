'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PLANS, PLAN_FEATURES } from '@/lib/constants';
import type { Plan } from '@/lib/types';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal: any;
  }
}

const PAYPAL_PLAN_IDS = {
  solo_monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_SOLO_MONTHLY ?? '',
  solo_yearly:  process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_SOLO_YEARLY  ?? '',
  team_monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_TEAM_MONTHLY ?? '',
  team_yearly:  process.env.NEXT_PUBLIC_PAYPAL_PLAN_ID_TEAM_YEARLY  ?? '',
};

// ── PayPal button for a single plan+billing combo ─────────────────────────────

interface PayPalBtnProps {
  planKey: 'solo' | 'team';
  planId:  string;
  label:   string;
}

function PayPalButton({ planKey, planId, label }: PayPalBtnProps) {
  const containerId = `paypal-btn-${planKey}-${planId.slice(-6) || 'dev'}`;
  const rendered    = useRef(false);
  const [loading, setLoading]   = useState(true);
  const [approved, setApproved] = useState(false);

  const initButtons = useCallback(() => {
    if (!window.paypal || rendered.current) return;
    rendered.current = true;
    setLoading(false);

    window.paypal.Buttons({
      style: {
        shape:  'pill',
        color:  'gold',
        layout: 'horizontal',
        label:  'subscribe',
        height: 40,
      },
      createSubscription: (_data: unknown, actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } }) => {
        return actions.subscription.create({ plan_id: planId });
      },
      onApprove: async (data: { subscriptionID: string }) => {
        setApproved(true);
        try {
          await fetch('/api/paypal/subscription', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ subscriptionID: data.subscriptionID, planKey }),
          });
          toast.success('Subscription activated! Refreshing your plan…');
          setTimeout(() => window.location.reload(), 1500);
        } catch {
          toast.error('Subscription recorded — it may take a moment to activate.');
        }
      },
      onError: () => {
        toast.error('PayPal checkout failed. Please try again.');
        rendered.current = false;
        setLoading(true);
      },
    }).render(`#${containerId}`);
  }, [containerId, planId, planKey]);

  useEffect(() => {
    if (window.paypal) {
      initButtons();
      return;
    }
    const existing = document.querySelector(`script[data-paypal-sdk]`);
    if (!existing) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
      script.dataset.paypalSdk = '1';
      script.onload = initButtons;
      document.body.appendChild(script);
    } else {
      existing.addEventListener('load', initButtons);
    }
  }, [initButtons]);

  if (approved) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Activating your plan…
      </div>
    );
  }

  return (
    <div className="relative min-h-[44px]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <div id={containerId} />
    </div>
  );
}

// ── Upgrade card ──────────────────────────────────────────────────────────────

function UpgradeCard({ planKey, yearly }: { planKey: 'solo' | 'team'; yearly: boolean }) {
  const meta   = PLANS[planKey];
  const planId = yearly ? PAYPAL_PLAN_IDS[`${planKey}_yearly`] : PAYPAL_PLAN_IDS[`${planKey}_monthly`];
  const price  = yearly ? meta.price_yearly  : meta.price_monthly;
  const period = yearly ? '/year' : '/month';
  const savings = meta.price_monthly * 12 - meta.price_yearly;

  return (
    <div className={`tc-card p-5 ${planKey === 'team' ? 'border-violet-300/40 dark:border-violet-700/30' : 'border-primary/30'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-bold text-sm">{meta.name} plan</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold tabular-nums text-primary">${price}</span>
            <span className="text-xs text-muted-foreground">{period}</span>
          </div>
          {yearly && savings > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
              Save ${savings}/year
            </p>
          )}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
          planKey === 'solo' ? 'bg-primary/10 text-primary' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
        }`}>
          {meta.name}
        </span>
      </div>

      <ul className="mb-4 space-y-1.5">
        {PLAN_FEATURES[planKey].map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
            {f}
          </li>
        ))}
      </ul>

      {planId ? (
        <PayPalButton planKey={planKey} planId={planId} label={`Subscribe to ${meta.name}`} />
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          PayPal plan ID not configured. Set NEXT_PUBLIC_PAYPAL_PLAN_ID_{planKey.toUpperCase()}_{yearly ? 'YEARLY' : 'MONTHLY'} in your environment.
        </p>
      )}
    </div>
  );
}

// ── Main billing client component ─────────────────────────────────────────────

interface BillingClientProps {
  currentPlan: Plan;
  planExpiresAt: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
}

export function BillingClient({ currentPlan, planExpiresAt, subscriptionId, subscriptionStatus }: BillingClientProps) {
  const [yearly, setYearly]   = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isPaid = currentPlan !== 'free';
  const isTeam = currentPlan === 'team';

  async function handleCancel() {
    if (!confirm('Cancel your subscription? Your plan stays active until the current period ends, then reverts to Free.')) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/paypal/cancel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscriptionID: subscriptionId }),
      });
      if (!res.ok) throw new Error();
      toast.success('Subscription cancelled. Access continues until the period ends.');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Failed to cancel subscription. Please contact support.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Current plan summary */}
      <div className="tc-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{PLANS[currentPlan].name} Plan</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                currentPlan === 'team' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                : currentPlan === 'solo' ? 'bg-primary/10 text-primary'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {isPaid ? (subscriptionStatus ?? 'active') : 'free'}
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-1">
              {isPaid ? (
                <>
                  <span className="text-2xl font-bold tabular-nums">
                    ${PLANS[currentPlan].price_monthly}
                  </span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </>
              ) : (
                <span className="text-2xl font-bold">Free forever</span>
              )}
            </div>

            {planExpiresAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                {subscriptionStatus === 'cancelled' ? 'Access ends' : 'Renews'}{' '}
                {new Date(planExpiresAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            )}
          </div>

          {isPaid && subscriptionStatus !== 'cancelled' && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="tc-btn-secondary border-destructive/30 text-destructive hover:bg-destructive/5 text-xs disabled:opacity-50 shrink-0"
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Cancel subscription'}
            </button>
          )}
        </div>

        {/* Current plan features */}
        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {PLAN_FEATURES[currentPlan].map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Upgrade section */}
      {!isTeam && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold">
              {currentPlan === 'free' ? 'Upgrade your plan' : 'Upgrade to Team'}
            </p>

            {/* Billing toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setYearly(false)}
                className={`text-xs font-medium transition-colors ${!yearly ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setYearly(!yearly)}
                className="relative flex h-5 w-9 items-center rounded-full border border-border bg-muted transition-colors"
                style={yearly ? { background: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))' } : undefined}
              >
                <span
                  className="absolute h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: yearly ? 'translateX(17px)' : 'translateX(1px)' }}
                />
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`text-xs font-medium transition-colors ${yearly ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                Yearly
              </button>
              {yearly && (
                <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">
                  Save up to 27%
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {currentPlan === 'free' && <UpgradeCard planKey="solo" yearly={yearly} />}
            <UpgradeCard planKey="team" yearly={yearly} />
          </div>
        </div>
      )}

      {/* Subscription info */}
      {subscriptionId && (
        <div className="tc-card p-4">
          <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Subscription</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-mono">{subscriptionId}</span>
            <a
              href="https://www.paypal.com/myaccount/autopay/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Manage in PayPal
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
