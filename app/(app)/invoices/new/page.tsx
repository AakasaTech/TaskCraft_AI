import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { InvoiceWizard } from './_components/InvoiceWizard';

export const metadata: Metadata = { title: 'New Invoice' };

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const userPlan = profile?.plan ?? 'free';

  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="New Invoice" subtitle="Create an invoice from billable time" />
        <UpgradePrompt feature="billcraft_sync" requiredPlan="solo" />
      </div>
    );
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const workspaceId = member?.workspace_id;

  // Check BillCraft is connected
  const { data: bcSettings } = workspaceId
    ? await supabase
        .from('integration_settings')
        .select('enabled')
        .eq('workspace_id', workspaceId)
        .eq('integration_type', 'billcraft')
        .single()
    : { data: null };

  if (!bcSettings?.enabled) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />Back to Invoices
        </Link>
        <PageHeader title="New Invoice" subtitle="Create an invoice from billable time" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">BillCraft not connected</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            You need to connect BillCraft AI before creating invoices.{' '}
            <Link href="/integrations/billcraft" className="underline font-medium">Set it up →</Link>
          </p>
        </div>
      </div>
    );
  }

  // Pre-fetch workspace projects for the scope selector
  const { data: projects } = workspaceId
    ? await supabase
        .from('projects')
        .select('id, name, color, status')
        .eq('workspace_id', workspaceId)
        .in('status', ['active', 'not_started'])
        .order('name')
    : { data: [] };

  // Workspace currency + hourly rate defaults
  const { data: workspace } = workspaceId
    ? await supabase
        .from('workspaces')
        .select('settings')
        .eq('id', workspaceId)
        .single()
    : { data: null };

  const wsSettings = (workspace?.settings ?? {}) as Record<string, unknown>;
  const currency   = (wsSettings.currency as string | undefined) ?? 'USD';
  const hourlyRate = (wsSettings.hourly_rate as number | undefined) ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link href="/invoices" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />Back to Invoices
        </Link>
        <div className="mt-3">
          <PageHeader title="New Invoice" subtitle="Select billable time entries and send to BillCraft AI" />
        </div>
      </div>

      <div className="tc-card p-6">
        <InvoiceWizard
          projects={(projects ?? []) as import('@/lib/types').Project[]}
          currency={currency}
          hourlyRate={hourlyRate}
        />
      </div>
    </div>
  );
}
