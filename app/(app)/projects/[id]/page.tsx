import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { ProjectStatusBadge } from '@/components/shared/StatusBadge';
import { ProjectDetailClient } from './_components/ProjectDetailClient';
import type { DetailTask, DetailTimeEntry, DetailMember } from './_components/ProjectDetailClient';
import type { TaskStatus, TaskPriority, ProjectMemberRole, ProjectStatus } from '@/lib/types';
import { getEffectivePlan } from '@/lib/plan-gates';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: project?.name ?? 'Project' };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const wid = currentUser.workspace.id;
  const effectivePlan = getEffectivePlan(
    currentUser.profile.plan as import('@/lib/types').Plan,
    currentUser.profile.planExpiresAt?.toISOString() ?? null
  );
  const isTeamPlan = effectivePlan === 'team';

  // Core project
  const project = await prisma.project.findFirst({
    where: {
      id,
      workspaceId: wid,
    },
    include: {
      client: { select: { id: true, name: true, company: true } },
    },
  });

  if (!project) notFound();

  // Fetch tasks, time entries, members, clients in parallel
  const [tasksRes, timeRes, membersRes, clientsRes] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: id },
      include: {
        assignee: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.timeEntry.findMany({
      where: {
        projectId: id,
        durationMinutes: { not: null },
      },
      include: {
        user: { select: { fullName: true } },
      },
      orderBy: { startTime: 'desc' },
    }),

    isTeamPlan
      ? prisma.projectMember.findMany({
          where: { projectId: id },
          include: {
            user: { select: { fullName: true, email: true, avatarUrl: true } },
          },
        })
      : Promise.resolve([]),

    prisma.client.findMany({
      where: { workspaceId: wid },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const now = new Date();

  // Shape tasks
  const tasks: DetailTask[] = tasksRes.map((t) => {
    return {
      id:            t.id,
      title:         t.title,
      status:        t.status as TaskStatus,
      priority:      t.priority as TaskPriority,
      due_date:      t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
      assignee_id:   t.assigneeId,
      assignee_name: t.assignee?.fullName ?? null,
    };
  });

  // Shape time entries
  const timeEntries: DetailTimeEntry[] = timeRes.map((e) => {
    return {
      id:               e.id,
      description:      e.description,
      start_time:       e.startTime.toISOString(),
      duration_minutes: e.durationMinutes ?? 0,
      billable:         e.billable,
      user_id:          e.userId,
      user_name:        e.user?.fullName ?? null,
    };
  });

  // Shape members
  const members: DetailMember[] = membersRes.map((m) => {
    return {
      user_id:    m.userId,
      role:       m.role as ProjectMemberRole,
      full_name:  m.user?.fullName ?? null,
      email:      m.user?.email ?? '',
      avatar_url: m.user?.avatarUrl ?? null,
    };
  });

  const clients = clientsRes.map((c) => ({
    id:      c.id,
    name:    c.name,
    company: c.company,
  }));

  // Aggregated stats
  const totalMinutes  = timeEntries.reduce((s, e) => s + e.duration_minutes, 0);
  const billableMinutes = timeEntries.filter((e) => e.billable).reduce((s, e) => s + e.duration_minutes, 0);
  const hoursLogged   = Math.round((totalMinutes / 60) * 10) / 10;
  const billableHours = Math.round((billableMinutes / 60) * 10) / 10;
  const hourlyRate    = project.hourlyRate ? Number(project.hourlyRate) : 0;
  const budget        = project.budget ? Number(project.budget) : 0;
  const budgetUsed    = billableHours * hourlyRate;

  const doneCount    = tasks.filter((t) => t.status === 'done').length;
  const openCount    = tasks.filter((t) => t.status !== 'done').length;
  const overdueCount = tasks.filter(
    (t) => t.due_date && t.status !== 'done' && new Date(t.due_date) < now,
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back link */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Projects
        </Link>
      </div>

      {/* Header card */}
      <div className="tc-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span
              className="h-12 w-12 shrink-0 rounded-2xl shadow-sm"
              style={{ background: project.color }}
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">{project.name}</h1>
                <ProjectStatusBadge status={project.status as ProjectStatus} />
              </div>
              {project.description && (
                <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              )}
              {project.client && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Client:{' '}
                  <span className="font-medium text-foreground">
                    {project.client.name}
                    {project.client.company ? ` · ${project.client.company}` : ''}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {project.startDate && (
              <div>
                <span className="font-semibold text-foreground">Start:</span>{' '}
                {project.startDate.toISOString().split('T')[0]}
              </div>
            )}
            {project.dueDate && (
              <div>
                <span className="font-semibold text-foreground">Due:</span>{' '}
                {project.dueDate.toISOString().split('T')[0]}
              </div>
            )}
            {hourlyRate > 0 && (
              <div>
                <span className="font-semibold text-foreground">Rate:</span> ${hourlyRate}/h
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs client */}
      <ProjectDetailClient
        project={{
          id:             project.id,
          name:           project.name,
          description:    project.description ?? undefined,
          color:          project.color,
          status:         project.status as ProjectStatus,
          client_id:      project.clientId ?? undefined,
          client_name:    project.client?.name ?? null,
          start_date:     project.startDate ? project.startDate.toISOString().split('T')[0] : undefined,
          due_date:       project.dueDate ? project.dueDate.toISOString().split('T')[0] : undefined,
          budget:         project.budget ? Number(project.budget) : null,
          hourly_rate:    project.hourlyRate ? Number(project.hourlyRate) : null,
          billable:       project.billable,
          hours_logged:   hoursLogged,
          billable_hours: billableHours,
          budget_used:    budgetUsed,
          task_count:     tasks.length,
          done_count:     doneCount,
          open_count:     openCount,
          overdue_count:  overdueCount,
        }}
        tasks={tasks}
        timeEntries={timeEntries}
        members={members}
        clients={clients}
        isTeamPlan={isTeamPlan}
        currentUserId={currentUser.profile.id}
      />
    </div>
  );
}
