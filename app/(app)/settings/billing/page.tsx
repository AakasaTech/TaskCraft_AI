import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSection } from '@/components/shared/SettingsSection';
import { BillingClient } from './_components/BillingClient';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Billing' };

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, subRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('plan, plan_expires_at')
      .eq('id', user.id)
      .single(),

    supabase
      .from('subscriptions')
      .select('paypal_subscription_id, status, current_period_end, cancelled_at, trial_ends_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const currentPlan    = (profileRes.data?.plan ?? 'free') as Plan;
  const planExpiresAt  = profileRes.data?.plan_expires_at ?? null;
  const subscription   = subRes.data;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Billing"
        subtitle="Manage your subscription and payment method"
      />

      <SettingsSection
        title="Plan & Subscription"
        description="Your current plan and upgrade options."
      >
        <BillingClient
          userId={user.id}
          currentPlan={currentPlan}
          planExpiresAt={planExpiresAt}
          trialEndsAt={subscription?.trial_ends_at ?? null}
          subscriptionId={subscription?.paypal_subscription_id ?? null}
          subscriptionStatus={subscription?.status ?? null}
        />
      </SettingsSection>

      {/* Billing FAQ */}
      <SettingsSection
        title="Billing FAQ"
        description="Common questions about billing and plans."
      >
        <div className="space-y-4 text-sm text-muted-foreground">
          {[
            {
              q: 'How does the free trial work?',
              a: 'All paid plans include a 14-day free trial. You won\'t be charged until the trial ends. You can cancel at any time during the trial.',
            },
            {
              q: 'Can I switch plans?',
              a: 'Yes. Upgrade at any time and your new plan activates immediately. To downgrade, cancel your current subscription — when it expires, your account reverts to Free.',
            },
            {
              q: 'What payment methods are accepted?',
              a: 'We accept all major cards and PayPal balance through the PayPal checkout. No credit card required to start.',
            },
            {
              q: 'What happens to my data if I downgrade?',
              a: 'Your data is preserved. If you have more than 3 projects, they\'ll remain accessible in read-only mode until you upgrade again.',
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="font-semibold text-foreground">{q}</p>
              <p className="mt-0.5">{a}</p>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  );
}
