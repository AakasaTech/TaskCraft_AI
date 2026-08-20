import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReportsClient } from './_components/ReportsClient';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import type { ReportTimeEntry, ReportProject, ReportTask, ReportMember } from './_types';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  // Gate: Reports require Solo or Team plan
  const userPlan = getEffectivePlan(
    currentUser.profile.plan as Plan,
    currentUser.profile.planExpiresAt?.toISOString() ?? null
  );

  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Reports" subtitle="Analyse project progress, team productivity, and billable hours" />
        <UpgradePrompt feature="reports" requiredPlan="solo" />
      </div>
    );
  }

  const wid = currentUser.workspace.id;

  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const [entriesRes, projectsRes, tasksRes, membersRes] = await Promise.all([
    // Time entries — last 12 months, all workspace users
    prisma.timeEntry.findMany({
      where: {
        workspaceId: wid,
        endTime: { not: null },
        startTime: { gte: since },
      },
      include: {
        task: { select: { title: true } },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            clientId: true,
            client: { select: { id: true, name: true } },
          },
        },
        user: { select: { fullName: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 5000,
    }),

    // All projects
    prisma.project.findMany({
      where: { workspaceId: wid },
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    }),

    // All top-level tasks
    prisma.task.findMany({
      where: {
        workspaceId: wid,
        parentTaskId: null,
      },
      include: {
        project: { select: { name: true, color: true } },
        assignee: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3000,
    }),

    // Workspace members
    prisma.workspaceMember.findMany({
      where: { workspaceId: wid },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, email: true } },
      },
    }),
  ]);

  // Shape time entries
  const entries: ReportTimeEntry[] = entriesRes.map((e) => ({
    id:               e.id,
    project_id:       e.projectId,
    project_name:     e.project?.name ?? null,
    project_color:    e.project?.color ?? null,
    client_id:        e.project?.client?.id ?? e.project?.clientId ?? null,
    client_name:      e.project?.client?.name ?? null,
    task_id:          e.taskId,
    task_title:       e.task?.title ?? null,
    user_id:          e.userId,
    user_name:        e.user?.fullName ?? null,
    description:      e.description,
    start_time:       e.startTime.toISOString(),
    duration_minutes: e.durationMinutes,
    billable:         e.billable,
    hourly_rate:      e.hourlyRate ? Number(e.hourlyRate) : null,
    invoice_status:   e.invoiceStatus as ReportTimeEntry['invoice_status'],
  }));

  // Build per-project stats
  const taskCountMap: Record<string, { total: number; done: number }> = {};
  for (const t of tasksRes) {
    if (!t.projectId) continue;
    if (!taskCountMap[t.projectId]) taskCountMap[t.projectId] = { total: 0, done: 0 };
    taskCountMap[t.projectId].total++;
    if (t.status === 'done') taskCountMap[t.projectId].done++;
  }

  const hoursMap: Record<string, number> = {};
  for (const e of entries) {
    if (!e.project_id) continue;
    hoursMap[e.project_id] = (hoursMap[e.project_id] ?? 0) + (e.duration_minutes ?? 0);
  }

  const projects: ReportProject[] = projectsRes.map((p) => ({
    id:           p.id,
    name:         p.name,
    color:        p.color,
    status:       p.status as ReportProject['status'],
    client_id:    p.client?.id ?? p.clientId ?? null,
    client_name:  p.client?.name ?? null,
    due_date:     p.dueDate ? p.dueDate.toISOString().split('T')[0] : null,
    budget:       p.budget ? Number(p.budget) : null,
    hourly_rate:  p.hourlyRate ? Number(p.hourlyRate) : null,
    billable:     p.billable,
    task_total:   taskCountMap[p.id]?.total ?? 0,
    task_done:    taskCountMap[p.id]?.done  ?? 0,
    hours_logged: Math.round((hoursMap[p.id] ?? 0) * 10) / 10,
  }));

  // Shape tasks
  const tasks: ReportTask[] = tasksRes.map((t) => ({
    id:              t.id,
    title:           t.title,
    status:          t.status as ReportTask['status'],
    priority:        t.priority as ReportTask['priority'],
    project_id:      t.projectId,
    project_name:    t.project?.name ?? null,
    project_color:   t.project?.color ?? null,
    assignee_id:     t.assigneeId,
    assignee_name:   t.assignee?.fullName ?? null,
    due_date:        t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
    estimated_hours: t.estimatedHours ? Number(t.estimatedHours) : null,
    actual_hours:    t.actualHours ? Number(t.actualHours) : 0,
    created_at:      t.createdAt.toISOString(),
    completed_at:    t.completedAt?.toISOString() ?? null,
  }));

  // Shape members
  const members: ReportMember[] = membersRes.map((m) => ({
    user_id:    m.user.id,
    name:       m.user.fullName || m.user.email,
    email:      m.user.email,
    avatar_url: m.user.avatarUrl,
  }));

  // Unique client list
  const clientSet = new Map<string, string>();
  for (const p of projects) {
    if (p.client_id && p.client_name) clientSet.set(p.client_id, p.client_name);
  }
  const clients = Array.from(clientSet.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isTeamPlan = userPlan === 'team';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Analyse project progress, team productivity, and billable hours"
      />
      <ReportsClient
        entries={entries}
        projects={projects}
        tasks={tasks}
        members={members}
        clients={clients}
        isTeamPlan={isTeamPlan}
        currentUserId={currentUser.profile.id}
      />
    </div>
  );
}
