import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { PageHeader } from '@/components/shared/PageHeader';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { BillCraftSettingsClient } from './_components/BillCraftSettingsClient';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'BillCraft AI Integration' };

export default async function BillCraftIntegrationPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const userPlan    = getEffectivePlan(currentUser.profile.plan as Plan, currentUser.profile.planExpiresAt?.toISOString() ?? null);
  const workspaceId = currentUser.workspace.id;

  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="BillCraft AI" subtitle="Integration settings" />
        <UpgradePrompt feature="integrations" requiredPlan="solo" />
      </div>
    );
  }

  const settings = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'billcraft' } },
    select: { enabled: true, config: true },
  });

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
