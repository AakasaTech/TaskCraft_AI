import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ArrowRight, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { PLANS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSection } from '@/components/shared/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user!.id)
    .single();

  const currentPlan = (profile?.plan ?? 'free') as keyof typeof PLANS;
  const plan = PLANS[currentPlan];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Billing" subtitle="Manage your subscription and invoices" />

      {/* Current plan card */}
      <SettingsSection title="Current Plan" description="Your active subscription.">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}`}
              </span>
              {plan.price_monthly > 0 && (
                <span className="text-sm text-muted-foreground">/month</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                {plan.name} Plan
              </span>
              {profile?.plan_expires_at && (
                <span className="text-xs text-muted-foreground">
                  · Renews {new Date(profile.plan_expires_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {currentPlan !== 'free' && (
            <button className="tc-btn-secondary border-destructive/30 text-destructive hover:bg-destructive/5 text-xs">
              Cancel subscription
            </button>
          )}
        </div>
      </SettingsSection>

      {/* Upgrade options */}
      {currentPlan !== 'team' && (
        <div>
          <p className="mb-3 text-sm font-semibold">Available Upgrades</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['solo', 'team'] as const)
              .filter((p) => p !== currentPlan)
              .map((key) => {
                const p = PLANS[key];
                return (
                  <div
                    key={key}
                    className={`tc-card p-5 ${key === 'team' ? 'border-primary/30' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{p.name}</p>
                      <span className="text-xl font-bold text-primary">
                        ${p.price_monthly}
                        <span className="text-xs font-normal text-muted-foreground">/mo</span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">or ${p.price_yearly}/year</p>
                    <Link
                      href="/pricing"
                      className="tc-btn-primary mt-4 flex w-full justify-center"
                    >
                      Upgrade to {p.name}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Billing history */}
      <SettingsSection title="Billing History" description="Past invoices and receipts.">
        <EmptyState
          icon={CreditCard}
          title="No invoices yet"
          description="Your billing history will appear here once you upgrade to a paid plan."
        />
      </SettingsSection>
    </div>
  );
}
