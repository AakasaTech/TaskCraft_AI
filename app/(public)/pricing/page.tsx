'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { PLANS, PLAN_FEATURES } from '@/lib/constants';

const PLAN_DATA = [
  {
    key:         'free'  as const,
    description: 'Get started for free. No credit card required.',
    cta:         'Get started free',
    ctaHref:     '/register',
    highlighted: false,
    badge:       null as string | null,
  },
  {
    key:         'solo'  as const,
    description: 'For freelancers and independent professionals.',
    cta:         'Start Solo — 14 days free',
    ctaHref:     '/register?plan=solo',
    highlighted: true,
    badge:       'Most popular' as string | null,
  },
  {
    key:         'team'  as const,
    description: 'For growing teams that need to collaborate.',
    cta:         'Start Team — 14 days free',
    ctaHref:     '/register?plan=team',
    highlighted: false,
    badge:       null as string | null,
  },
];

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
        className="relative flex h-6 w-11 shrink-0 items-center rounded-full border border-border bg-muted transition-colors"
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
        <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-semibold">
          Save up to 27%
        </span>
      </div>
    </div>
  );
}

function PlanCard({ plan, yearly }: { plan: typeof PLAN_DATA[number]; yearly: boolean }) {
  const meta    = PLANS[plan.key];
  const price   = yearly && meta.price_yearly > 0 ? meta.price_yearly : meta.price_monthly;
  const period  = yearly ? '/year' : '/month';
  const isFree  = meta.price_monthly === 0;
  const savings = meta.price_monthly * 12 - meta.price_yearly;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-7 transition-shadow ${
        plan.highlighted ? 'shadow-2xl' : 'border-border bg-card shadow-sm hover:shadow-md'
      }`}
      style={plan.highlighted ? {
        borderColor: 'hsl(var(--primary))',
        borderWidth: '2px',
        background:  'linear-gradient(160deg, hsl(var(--primary) / 0.05) 0%, transparent 60%)',
      } : undefined}
    >
      {plan.badge && (
        <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-0.5 text-xs font-bold ${
          plan.highlighted ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary border border-primary/20'
        }`}>
          {plan.badge}
        </div>
      )}

      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{meta.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>

      <div className="mt-5 flex items-baseline gap-1">
        {isFree ? (
          <span className="text-4xl font-bold">Free</span>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">$</span>
            <span className="text-4xl font-bold tabular-nums">{price}</span>
            <span className="text-sm text-muted-foreground">{period}</span>
          </>
        )}
      </div>

      {!isFree && (
        <p className="mt-1 text-xs text-muted-foreground">
          {yearly
            ? savings > 0 ? `≈ $${Math.round(meta.price_yearly / 12)}/month · save $${savings} vs monthly` : 'Billed annually'
            : `or $${meta.price_yearly}/year (save $${savings})`
          }
        </p>
      )}

      <a
        href={plan.ctaHref}
        className={`mt-5 block rounded-xl py-2.5 text-center text-sm font-semibold transition-all active:scale-[0.98] ${
          plan.highlighted ? 'tc-btn-primary w-full' : 'tc-btn-secondary w-full'
        }`}
      >
        {plan.cta}
      </a>

      <ul className="mt-6 space-y-3 flex-1">
        {PLAN_FEATURES[plan.key].map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-5xl">

        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade only when you need more.
          </p>
        </div>

        <div className="mb-10">
          <BillingToggle yearly={yearly} onChange={setYearly} />
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {PLAN_DATA.map((plan) => (
            <PlanCard key={plan.key} plan={plan} yearly={yearly} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          All paid plans include a 14-day free trial · No credit card required to start
          · Billing via PayPal · Cancel any time
        </p>

        {/* Feature comparison table */}
        <div className="mt-16 rounded-2xl border border-border overflow-hidden">
          <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
            <span>Feature</span>
            <span className="text-center">Free</span>
            <span className="text-center text-primary">Solo</span>
            <span className="text-center">Team</span>
          </div>
          <div className="divide-y divide-border">
            {[
              { feature: 'Projects',                 free: 'Up to 3',     solo: 'Unlimited',       team: 'Unlimited' },
              { feature: 'Tasks',                    free: 'Unlimited',   solo: 'Unlimited',       team: 'Unlimited' },
              { feature: 'Time tracking',            free: 'Basic',       solo: 'Full',            team: 'Full + team' },
              { feature: 'AI assistant',             free: '5 req/month', solo: 'Unlimited',       team: 'Unlimited + team' },
              { feature: 'Reports & analytics',      free: '—',           solo: '✓',               team: '✓' },
              { feature: 'Client management',        free: '—',           solo: '✓',               team: '✓' },
              { feature: 'CSV exports',              free: '—',           solo: '✓',               team: '✓' },
              { feature: 'BillCraft AI sync',        free: '—',           solo: '✓',               team: '✓' },
              { feature: 'SupportCraft AI sync',     free: '—',           solo: '✓',               team: '✓' },
              { feature: 'Team members',             free: '1',           solo: '1',               team: 'Unlimited' },
              { feature: 'Roles & permissions',      free: '—',           solo: '—',               team: '✓' },
              { feature: 'Team workload reports',    free: '—',           solo: '—',               team: '✓' },
              { feature: 'Audit logs',               free: '—',           solo: '—',               team: '✓' },
              { feature: 'Priority support',         free: '—',           solo: '—',               team: '✓' },
            ].map(({ feature, free, solo, team }) => (
              <div key={feature} className="grid grid-cols-4 gap-4 px-6 py-3 text-sm hover:bg-muted/20 transition-colors">
                <span className="text-muted-foreground">{feature}</span>
                <span className="text-center text-muted-foreground">{free}</span>
                <span className="text-center font-medium">{solo}</span>
                <span className="text-center text-muted-foreground">{team}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Annual savings callout */}
        <div className="mt-10 rounded-2xl border border-border bg-muted/50 px-6 py-5 text-center">
          <p className="text-sm font-semibold">Save with annual billing</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo yearly: <strong>$89/year</strong> (save $19) &nbsp;·&nbsp;
            Team yearly: <strong>$189/year</strong> (save $39)
          </p>
          <a href="/register" className="tc-btn-primary mt-4 inline-flex">
            Get started free →
          </a>
        </div>

      </div>
    </div>
  );
}
