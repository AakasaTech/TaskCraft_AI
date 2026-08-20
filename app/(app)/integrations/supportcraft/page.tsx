import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { PageHeader } from '@/components/shared/PageHeader';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { SupportCraftSettingsClient } from './_components/SupportCraftSettingsClient';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'SupportCraft AI Integration' };

export default async function SupportCraftIntegrationPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const userPlan    = getEffectivePlan(currentUser.profile.plan as Plan, currentUser.profile.planExpiresAt?.toISOString() ?? null);
  const workspaceId = currentUser.workspace.id;

  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="SupportCraft AI" subtitle="Integration settings" />
        <UpgradePrompt feature="integrations" requiredPlan="solo" />
      </div>
    );
  }

  const [settings, projects] = await Promise.all([
    prisma.integrationSetting.findUnique({
      where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
      select: { enabled: true, config: true },
    }),
    prisma.project.findMany({
      where: { workspaceId, status: { in: ['active', 'not_started'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const cfg              = (settings?.config ?? {}) as Record<string, unknown>;
  const connected        = settings?.enabled ?? false;
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
        workspaceId={workspaceId}
        projects={projects}
      />
    </div>
  );
}
