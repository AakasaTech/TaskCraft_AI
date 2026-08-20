import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { TasksClient } from './_components/TasksClient';
import type { TaskRich, LabelChip, TaskMember, TaskProject } from './_types';
import type { TaskStatus, TaskPriority } from '@/lib/types';

export const metadata: Metadata = { title: 'Tasks' };

export default async function TasksPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const wid = currentUser.workspace.id;

  // Fetch everything in parallel via Prisma
  const [tasksRes, projectsRes, membersRes, labelsRes] = await Promise.all([
    prisma.task.findMany({
      where: { workspaceId: wid },
      include: {
        project: { select: { id: true, name: true, color: true } },
        assignee: { select: { id: true, fullName: true, avatarUrl: true } },
        labels: {
          include: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: [
        { position: 'asc' },
        { createdAt: 'desc' },
      ],
    }),

    prisma.project.findMany({
      where: {
        workspaceId: wid,
        status: { not: 'archived' },
      },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),

    prisma.workspaceMember.findMany({
      where: { workspaceId: wid },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true, email: true },
        },
      },
    }),

    prisma.taskLabel.findMany({
      where: { workspaceId: wid },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Compute subtask counts
  const subtaskCounts: Record<string, { total: number; done: number }> = {};
  for (const t of tasksRes) {
    if (t.parentTaskId) {
      if (!subtaskCounts[t.parentTaskId]) subtaskCounts[t.parentTaskId] = { total: 0, done: 0 };
      subtaskCounts[t.parentTaskId].total++;
      if (t.status === 'done') subtaskCounts[t.parentTaskId].done++;
    }
  }

  // Shape tasks
  const tasks: TaskRich[] = tasksRes.map((t) => {
    const taskLabels: LabelChip[] = t.labels.map((la) => ({
      id: la.label.id,
      name: la.label.name,
      color: la.label.color,
    }));

    return {
      id:                t.id,
      workspace_id:      t.workspaceId,
      title:             t.title,
      description:       t.description ?? null,
      status:            t.status as TaskStatus,
      priority:          t.priority as TaskPriority,
      due_date:          t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
      start_date:        t.startDate ? t.startDate.toISOString().split('T')[0] : null,
      estimated_hours:   t.estimatedHours ? Number(t.estimatedHours) : null,
      actual_hours:      t.actualHours ? Number(t.actualHours) : 0,
      billable:          t.billable,
      hourly_rate:       t.hourlyRate ? Number(t.hourlyRate) : null,
      position:          t.position,
      project_id:        t.projectId ?? null,
      project_name:      t.project?.name ?? null,
      project_color:     t.project?.color ?? null,
      assignee_id:       t.assigneeId ?? null,
      assignee_name:     t.assignee?.fullName ?? null,
      assignee_avatar:   t.assignee?.avatarUrl ?? null,
      parent_task_id:    t.parentTaskId ?? null,
      labels:            taskLabels,
      subtask_count:      subtaskCounts[t.id]?.total ?? 0,
      done_subtask_count: subtaskCounts[t.id]?.done  ?? 0,
      created_at:        t.createdAt.toISOString(),
      completed_at:      t.completedAt ? t.completedAt.toISOString() : null,
    };
  });

  const projects: TaskProject[] = projectsRes.map((p) => ({
    id:    p.id,
    name:  p.name,
    color: p.color,
  }));

  const members: TaskMember[] = membersRes.map((m) => ({
    id:         m.user.id,
    full_name:  m.user.fullName,
    avatar_url: m.user.avatarUrl,
    email:      m.user.email,
  }));

  const labels: LabelChip[] = labelsRes.map((l) => ({
    id:    l.id,
    name:  l.name,
    color: l.color,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        subtitle="Manage and track tasks across all your projects."
      />
      <TasksClient
        tasks={tasks}
        projects={projects}
        members={members}
        labels={labels}
        currentUserId={currentUser.profile.id}
      />
    </div>
  );
}
