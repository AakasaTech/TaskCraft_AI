import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSection } from '@/components/shared/SettingsSection';
import { DataExportClient } from './_components/DataExportClient';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Data Export' };

export default async function DataExportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single();

  const plan = getEffectivePlan((profile?.plan ?? 'free') as Plan, profile?.plan_expires_at ?? null);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Data Export" subtitle="Download your data as CSV files at any time." />

      <SettingsSection
        title="Export your data"
        description="Each export generates a fresh CSV file with all your current data."
      >
        <DataExportClient plan={plan} />
      </SettingsSection>

      <SettingsSection title="Data retention">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your data is retained for as long as your account is active. When you cancel a paid
          subscription your data remains accessible on the Free plan. Deleting your account
          permanently removes all data within 30 days.
        </p>
      </SettingsSection>
    </div>
  );
}
