import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { ClientList } from './_components/ClientList';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import type { ClientWithStats } from './_components/ClientList';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Clients' };

export default async function ClientsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  // Gate: Clients require Solo or Team plan
  const userPlan = getEffectivePlan(
    currentUser.profile.plan as Plan,
    currentUser.profile.planExpiresAt?.toISOString() ?? null
  );

  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Clients" subtitle="Manage clients and link them to projects for billing" />
        <UpgradePrompt feature="clients" requiredPlan="solo" />
      </div>
    );
  }

  const wid = currentUser.workspace.id;

  const [clientsRes, projectsRes, timeRes] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: wid },
      orderBy: { name: 'asc' },
    }),

    prisma.project.findMany({
      where: {
        workspaceId: wid,
        clientId: { not: null },
      },
      select: { id: true, clientId: true },
    }),

    prisma.timeEntry.findMany({
      where: {
        workspaceId: wid,
        billable: true,
        durationMinutes: { not: null },
        projectId: { not: null },
      },
      select: { projectId: true, durationMinutes: true },
    }),
  ]);

  // Build project counts per client
  const projectCountMap: Record<string, number> = {};
  const projectClientMap: Record<string, string> = {};
  for (const p of projectsRes) {
    if (p.clientId) {
      projectCountMap[p.clientId] = (projectCountMap[p.clientId] ?? 0) + 1;
      projectClientMap[p.id] = p.clientId;
    }
  }

  // Billable hours per client (via projects)
  const billableMap: Record<string, number> = {};
  for (const e of timeRes) {
    if (!e.projectId || !e.durationMinutes) continue;
    const cid = projectClientMap[e.projectId];
    if (!cid) continue;
    billableMap[cid] = (billableMap[cid] ?? 0) + e.durationMinutes / 60;
  }

  const clients: ClientWithStats[] = clientsRes.map((c) => ({
    id:                  c.id,
    workspace_id:        c.workspaceId,
    name:                c.name,
    email:               c.email,
    billing_email:       null,
    phone:               c.phone,
    company:             c.company,
    website:             c.website,
    address:             (c.address as any) ?? {},
    notes:               c.notes,
    default_hourly_rate: null,
    currency:            'USD',
    billcraft_client_id: c.billcraftClientId,
    created_by:          c.createdById,
    created_at:          c.createdAt.toISOString(),
    updated_at:          c.updatedAt.toISOString(),
    project_count:       projectCountMap[c.id] ?? 0,
    open_task_count:     0,
    billable_hours:      Math.round((billableMap[c.id] ?? 0) * 10) / 10,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Clients"
        subtitle="Manage clients and link them to projects for billing"
      />
      <ClientList clients={clients} />
    </div>
  );
}
