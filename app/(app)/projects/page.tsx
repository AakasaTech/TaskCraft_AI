import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { ProjectsClient } from './_components/ProjectsClient';
import type { ProjectRow } from './_components/ProjectsClient';
import type { ProjectStatus, Plan } from '@/lib/types';
import { PLANS } from '@/lib/constants';
import { getEffectivePlan } from '@/lib/plan-gates';

export const metadata: Metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const wid = currentUser.workspace.id;

  // Fetch project data and clients in parallel via Prisma
  const [projectsRes, taskStatsRes, timeRes, clientsRes] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId: wid },
      include: {
        client: { select: { id: true, name: true, company: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.task.findMany({
      where: {
        workspaceId: wid,
        projectId: { not: null },
      },
      select: { projectId: true, status: true },
    }),

    prisma.timeEntry.findMany({
      where: {
        workspaceId: wid,
        projectId: { not: null },
        durationMinutes: { not: null },
      },
      select: { projectId: true, durationMinutes: true },
    }),

    prisma.client.findMany({
      where: { workspaceId: wid },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Build task stats per project
  const taskMap: Record<string, { total: number; done: number }> = {};
  for (const t of taskStatsRes) {
    if (t.projectId) {
      if (!taskMap[t.projectId]) taskMap[t.projectId] = { total: 0, done: 0 };
      taskMap[t.projectId].total++;
      if (t.status === 'done') taskMap[t.projectId].done++;
    }
  }

  // Build hours per project (durationMinutes / 60)
  const hoursMap: Record<string, number> = {};
  for (const e of timeRes) {
    if (e.projectId && e.durationMinutes) {
      hoursMap[e.projectId] = (hoursMap[e.projectId] ?? 0) + (e.durationMinutes / 60);
    }
  }

  // Shape projects
  const projects: ProjectRow[] = projectsRes.map((p) => {
    return {
      id:           p.id,
      name:         p.name,
      description:  p.description,
      color:        p.color,
      status:       p.status as ProjectStatus,
      client_id:    p.clientId,
      client_name:  p.client?.name ?? null,
      start_date:   p.startDate ? p.startDate.toISOString().split('T')[0] : null,
      due_date:     p.dueDate ? p.dueDate.toISOString().split('T')[0] : null,
      budget:       p.budget ? Number(p.budget) : null,
      hourly_rate:  p.hourlyRate ? Number(p.hourlyRate) : null,
      billable:     p.billable,
      task_count:   taskMap[p.id]?.total ?? 0,
      done_count:   taskMap[p.id]?.done ?? 0,
      hours_logged: Math.round((hoursMap[p.id] ?? 0) * 10) / 10,
    };
  });

  const clients = clientsRes.map((c) => ({
    id:      c.id,
    name:    c.name,
    company: c.company,
  }));

  const plan = getEffectivePlan(
    currentUser.profile.plan as Plan,
    currentUser.profile.planExpiresAt?.toISOString() ?? null
  );
  const projectLimit: number = PLANS[plan].max_projects;
  const activeCount   = projects.filter((p) => p.status !== 'archived').length;
  const atLimit       = projectLimit !== -1 && activeCount >= projectLimit;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Projects"
        subtitle="Manage and track all your projects"
      />

      {/* Plan usage banner — only shown for free plan */}
      {projectLimit !== -1 && (
        <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
          atLimit
            ? 'border-destructive/30 bg-destructive/5 text-destructive'
            : 'border-border bg-muted/50 text-muted-foreground'
        }`}>
          <span>
            {activeCount} / {projectLimit} active project{projectLimit !== 1 ? 's' : ''} used
            {atLimit ? ' — limit reached' : ''}
          </span>
          <Link
            href="/settings/billing"
            className="text-xs font-semibold text-primary hover:underline shrink-0"
          >
            Upgrade for unlimited →
          </Link>
        </div>
      )}

      <ProjectsClient projects={projects} clients={clients} />
    </div>
  );
}
