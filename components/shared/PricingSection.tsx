'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { PLANS } from '@/lib/constants';

const PLAN_DATA = [
  {
    key:         'free',
    name:        PLANS.free.name,
    price:       PLANS.free.price_monthly,
    yearlyPrice: PLANS.free.price_yearly,
    yearlySavings: null,
    description: 'Perfect for getting started.',
    features: [
      'Up to 3 projects',
      'Up to 50 tasks',
      'Basic time tracking',
      'Reports (7-day history)',
      'BillCraft AI integration',
    ],
    cta:         'Get started free',
    ctaHref:     '/register',
    highlighted: false,
    badge:       null,
  },
  {
    key:         'solo',
    name:        PLANS.solo.name,
    price:       PLANS.solo.price_monthly,
    yearlyPrice: PLANS.solo.price_yearly,
    yearlySavings: 19,
    description: 'For freelancers and independent professionals.',
    features: [
      'Unlimited projects & tasks',
      'Advanced time tracking',
      'Billable hours & custom rates',
      'Full reports & CSV exports',
      'BillCraft AI integration',
      'SupportCraft AI integration',
      'Priority support',
    ],
    cta:         'Start Solo plan',
    ctaHref:     '/register?plan=solo',
    highlighted: true,
    badge:       'Most popular',
  },
  {
    key:         'team',
    name:        PLANS.team.name,
    price:       PLANS.team.price_monthly,
    yearlyPrice: PLANS.team.price_yearly,
    yearlySavings: 39,
    description: 'For growing teams that need to collaborate.',
    features: [
      'Everything in Solo',
      'Team workspaces',
      'Unlimited team members',
      'Roles & permissions',
      'Task assignments',
      'Team time reports',
      'Shared project views',
      'Admin panel',
    ],
    cta:         'Start Team plan',
    ctaHref:     '/register?plan=team',
    highlighted: false,
    badge:       null,
  },
] as const;

function BillingToggle({ yearly, onChange }: { yearly: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={() => onChange(false)}
        className={`text-sm font-medium transition-colors ${!yearly ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      >
        Monthly
      </button>

      <button
        onClick={() => onChange(!yearly)}
        aria-label="Toggle billing cycle"
        className="relative flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={yearly ? { background: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary))' } : undefined}
      >
        <span
          className="absolute h-4 w-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: yearly ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(true)}
          className={`text-sm font-medium transition-colors ${yearly ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Yearly
        </button>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          Save up to 27%
        </span>
      </div>
    </div>
  );
}

function PlanCard({ plan, yearly }: { plan: typeof PLAN_DATA[number]; yearly: boolean }) {
  const price  = yearly && plan.yearlyPrice > 0 ? plan.yearlyPrice : plan.price;
  const period = yearly ? '/year' : '/month';

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-shadow ${
        plan.highlighted
          ? 'shadow-xl'
          : 'border-border bg-card shadow-sm hover:shadow-md'
      }`}
      style={plan.highlighted ? {
        borderColor: 'hsl(var(--primary))',
        borderWidth:  '2px',
        background:   'linear-gradient(160deg, hsl(var(--primary) / 0.04) 0%, transparent 60%)',
      } : undefined}
    >
      {/* Badge */}
      {plan.badge && (
        <div
          className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-0.5 text-[11px] font-semibold ${
            plan.highlighted
              ? 'bg-primary text-primary-foreground'
              : 'border border-primary/20 bg-primary/10 text-primary'
          }`}
        >
          {plan.badge}
        </div>
      )}

      {/* Name */}
      <h3 className="text-base font-bold">{plan.name}</h3>

      {/* Price */}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums">${price}</span>
        <span className="text-sm text-muted-foreground">{period}</span>
      </div>

      {yearly && plan.yearlySavings && (
        <p className="mt-1 text-xs text-muted-foreground">Save ${plan.yearlySavings}/year</p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{plan.description}</p>

      <hr className="my-5 border-border" />

      <ul className="flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
            <span className="text-foreground/80">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={plan.ctaHref}
        className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition-all ${
          plan.highlighted
            ? 'tc-btn-primary'
            : 'border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15'
        }`}
      >
        {plan.cta}
      </Link>
    </div>
  );
}

export function PricingSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="border-t border-border bg-muted/30 px-6 py-24">
      <div className="mx-auto max-w-7xl">

        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-muted-foreground">
            Free forever for solo users. Upgrade only when you need more power or team features.
          </p>
        </div>

        <div className="mt-10">
          <BillingToggle yearly={yearly} onChange={setYearly} />
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PLAN_DATA.map((plan) => (
            <PlanCard key={plan.key} plan={plan} yearly={yearly} />
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Prices in USD. All paid plans include a 14-day free trial. No credit card required to start. Cancel anytime.
        </p>

      </div>
    </section>
  );
}
