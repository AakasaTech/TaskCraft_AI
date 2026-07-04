import Link from 'next/link';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import type { PlanFeature } from '@/lib/plan-gates';
import { FEATURE_LABELS, FEATURE_DESCRIPTIONS, FEATURE_MIN_PLAN } from '@/lib/plan-gates';
import { PLANS } from '@/lib/constants';

interface UpgradePromptProps {
  feature: PlanFeature;
  /** Override minimum plan (defaults to FEATURE_MIN_PLAN[feature]) */
  requiredPlan?: 'solo' | 'team';
  /** Compact inline variant instead of full-page centered layout */
  inline?: boolean;
}

export function UpgradePrompt({ feature, requiredPlan, inline = false }: UpgradePromptProps) {
  const minPlan  = requiredPlan ?? FEATURE_MIN_PLAN[feature];
  const plan     = PLANS[minPlan];
  const label    = FEATURE_LABELS[feature];
  const desc     = FEATURE_DESCRIPTIONS[feature];
  const savings  = plan.price_monthly * 12 - plan.price_yearly;

  if (inline) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{desc}</p>
        </div>
        <Link
          href="/settings/billing"
          className="shrink-0 tc-btn-primary text-xs px-3 py-1.5 whitespace-nowrap inline-flex items-center gap-1"
        >
          Upgrade <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-6 animate-fade-in">
      <div className="mx-auto w-full max-w-md">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-5">
          <Lock className="h-7 w-7 text-primary" />
        </div>

        {/* Title + description */}
        <h2 className="text-xl font-bold">{label}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{desc}</p>

        {/* Plan callout */}
        <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-left">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{plan.name} plan</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                ${plan.price_monthly}/month &nbsp;·&nbsp; ${plan.price_yearly}/year
                {savings > 0 && ` (save $${savings})`}
              </p>
            </div>
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary capitalize">
              {plan.name}
            </span>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/settings/billing"
            className="tc-btn-primary inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to {plan.name}
          </Link>
          <Link
            href="/pricing"
            className="tc-btn-secondary inline-flex items-center justify-center"
          >
            Compare plans
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          14-day free trial · Cancel anytime · Billed via PayPal
        </p>
      </div>
    </div>
  );
}
