import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { SupportCraftSettingsClient } from './_components/SupportCraftSettingsClient';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'SupportCraft AI Integration' };

export default async function SupportCraftIntegrationPage() {
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
        <PageHeader title="SupportCraft AI" subtitle="Integration settings" />
        <UpgradePrompt feature="integrations" requiredPlan="solo" />
      </div>
    );
  }

  const [settingsRes, projectsRes] = await Promise.all([
    workspaceId
      ? supabase.from('integration_settings')
          .select('enabled, config')
          .eq('workspace_id', workspaceId)
          .eq('integration_type', 'supportcraft')
          .single()
      : Promise.resolve({ data: null }),
    workspaceId
      ? supabase.from('projects')
          .select('id, name')
          .eq('workspace_id', workspaceId)
          .in('status', ['active', 'not_started'])
          .order('name')
      : Promise.resolve({ data: [] }),
  ]);

  const cfg              = (settingsRes.data?.config ?? {}) as Record<string, unknown>;
  const connected        = settingsRes.data?.enabled ?? false;
  const apiKey           = (cfg.api_key           as string  | undefined) ?? '';
  const apiUrl           = (cfg.api_url           as string  | undefined) ?? '';
  const webhookSecret    = (cfg.webhook_secret    as string  | undefined) ?? '';
  const autoCreateTasks  = (cfg.auto_create_tasks as boolean | undefined) ?? false;
  const defaultProjectId = (cfg.default_project_id as string | undefined) ?? '';
  const syncStatusBack   = (cfg.sync_status_back  as boolean | undefined) ?? true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://your-domain.com';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link href="/integrations"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Integrations
        </Link>
        <PageHeader
          title="SupportCraft AI"
          subtitle="Turn support tickets into tasks automatically"
        />
      </div>

      <SupportCraftSettingsClient
        connected={connected}
        apiKey={apiKey}
        apiUrl={apiUrl}
        webhookSecret={webhookSecret}
        autoCreateTasks={autoCreateTasks}
        defaultProjectId={defaultProjectId}
        syncStatusBack={syncStatusBack}
        appUrl={appUrl}
        workspaceId={workspaceId ?? ''}
        projects={(projectsRes.data ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
