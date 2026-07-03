import type { Metadata } from 'next';
import { PLANS } from '@/lib/constants';
import { PricingCard } from '@/components/shared/PricingCard';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for TaskCraft AI. Free forever for solo users.',
};

const PLAN_DATA = [
  {
    key: 'free',
    name:        PLANS.free.name,
    price:       PLANS.free.price_monthly,
    yearlyPrice: PLANS.free.price_yearly,
    description: 'Perfect for getting started.',
    features: [
      'Up to 3 projects',
      'Up to 50 tasks',
      'Basic time tracking',
      'Reports (7-day history)',
      'BillCraft AI integration',
    ],
    ctaLabel: 'Get started free',
    ctaHref:  '/register',
  },
  {
    key: 'solo',
    name:        PLANS.solo.name,
    price:       PLANS.solo.price_monthly,
    yearlyPrice: PLANS.solo.price_yearly,
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
    highlighted: true,
    badge:       'Most popular',
    ctaLabel:    'Start Solo plan',
    ctaHref:     '/register?plan=solo',
  },
  {
    key: 'team',
    name:        PLANS.team.name,
    price:       PLANS.team.price_monthly,
    yearlyPrice: PLANS.team.price_yearly,
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
    ctaLabel: 'Start Team plan',
    ctaHref:  '/register?plan=team',
  },
];

export default function PricingPage() {
  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-14 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade only when you need more.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 sm:grid-cols-3">
          {PLAN_DATA.map((plan) => (
            <PricingCard
              key={plan.key}
              name={plan.name}
              price={plan.price}
              yearlyPrice={plan.yearlyPrice}
              description={plan.description}
              features={plan.features}
              highlighted={plan.highlighted}
              badge={plan.badge}
              ctaLabel={plan.ctaLabel}
              ctaHref={plan.ctaHref}
              billingCycle="monthly"
            />
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          All paid plans include a 14-day free trial · No credit card required to start
          · Billing via PayPal · Cancel any time
        </p>

        {/* Yearly savings callout */}
        <div className="mt-10 rounded-2xl border border-border bg-muted/50 px-6 py-5 text-center">
          <p className="text-sm font-semibold">Save with annual billing</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo yearly: <strong>$89/year</strong> (save $19) &nbsp;·&nbsp;
            Team yearly: <strong>$189/year</strong> (save $39)
          </p>
          <a href="/register" className="tc-btn-primary mt-4 inline-flex">
            Get started →
          </a>
        </div>
      </div>
    </div>
  );
}
