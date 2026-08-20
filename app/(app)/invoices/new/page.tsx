import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { InvoiceWizard } from './_components/InvoiceWizard';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'New Invoice' };

export default async function NewInvoicePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const userPlan = getEffectivePlan(
    currentUser.profile.plan as Plan,
    currentUser.profile.planExpiresAt?.toISOString() ?? null
  );

  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="New Invoice" subtitle="Create an invoice from billable time" />
        <UpgradePrompt feature="billcraft_sync" requiredPlan="solo" />
      </div>
    );
  }

  const workspaceId = currentUser.workspace.id;

  // Check BillCraft is connected
  const bcSettings = await prisma.integrationSetting.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId,
        integrationType: 'billcraft',
      },
    },
  });

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

  // Pre-fetch workspace projects
  const projects = await prisma.project.findMany({
    where: {
      workspaceId,
      status: { in: ['active', 'not_started'] },
    },
    select: {
      id: true,
      name: true,
      color: true,
      status: true,
      workspaceId: true,
      description: true,
      clientId: true,
      startDate: true,
      dueDate: true,
      budget: true,
      hourlyRate: true,
      billable: true,
      position: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  });

  const wsSettings = (currentUser.workspace.settings ?? {}) as Record<string, unknown>;
  const currency   = (wsSettings.currency as string | undefined) ?? 'USD';
  const hourlyRate = (wsSettings.hourly_rate as number | undefined) ?? 0;

  const shapedProjects = projects.map((p) => ({
    id:          p.id,
    workspace_id: p.workspaceId,
    client_id:   p.clientId,
    name:        p.name,
    description: p.description,
    color:       p.color,
    status:      p.status as any,
    start_date:  p.startDate?.toISOString().split('T')[0] ?? null,
    due_date:    p.dueDate?.toISOString().split('T')[0] ?? null,
    budget:      p.budget ? Number(p.budget) : null,
    hourly_rate: p.hourlyRate ? Number(p.hourlyRate) : null,
    billable:    p.billable,
    position:    p.position,
    created_by:  p.createdById,
    created_at:  p.createdAt.toISOString(),
    updated_at:  p.updatedAt.toISOString(),
  }));

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
          projects={shapedProjects as any}
          currency={currency}
          hourlyRate={hourlyRate}
        />
      </div>
    </div>
  );
}
