import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { BillCraftSettingsClient } from './_components/BillCraftSettingsClient';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'BillCraft AI Integration' };

export default async function BillCraftIntegrationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, memberRes] = await Promise.all([
    supabase.from('profiles').select('plan, plan_expires_at').eq('id', user.id).single(),
    supabase.from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .single(),
  ]);

  const userPlan    = getEffectivePlan((profileRes.data?.plan ?? 'free') as Plan, profileRes.data?.plan_expires_at ?? null);
  const workspaceId = memberRes.data?.workspace_id;

  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="BillCraft AI" subtitle="Integration settings" />
        <UpgradePrompt feature="integrations" requiredPlan="solo" />
      </div>
    );
  }

  const { data: settings } = workspaceId
    ? await supabase
        .from('integration_settings')
        .select('enabled, config')
        .eq('workspace_id', workspaceId)
        .eq('integration_type', 'billcraft')
        .single()
    : { data: null };

  const cfg             = (settings?.config ?? {}) as Record<string, string>;
  const connected       = settings?.enabled ?? false;
  const apiKey          = cfg.api_key ?? '';
  const apiUrl          = cfg.api_url ?? '';
  const lastClientSync  = cfg.last_client_sync_at ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link
          href="/integrations"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Integrations
        </Link>
        <PageHeader
          title="BillCraft AI"
          subtitle="Convert billable time entries into invoices with one click"
        />
      </div>

      <BillCraftSettingsClient
        connected={connected}
        apiKey={apiKey}
        apiUrl={apiUrl}
        lastClientSync={lastClientSync}
      />
    </div>
  );
}
