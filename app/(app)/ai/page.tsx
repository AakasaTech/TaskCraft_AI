import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { PageHeader } from '@/components/shared/PageHeader';
import { AIHub } from './_components/AIHub';
import { getEffectivePlan } from '@/lib/plan-gates';

export const metadata: Metadata = { title: 'AI Assistant' };

export default async function AIPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const plan = getEffectivePlan(currentUser.profile.plan as 'free' | 'solo' | 'team', currentUser.profile.planExpiresAt?.toISOString() ?? null);
  const wid  = currentUser.workspace.id;

  // Monthly usage for Free plan display
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const usageCount = await prisma.aiUsage.count({
    where: { userId: currentUser.profile.id, usedAt: { gte: since } },
  });

  // Projects for tool selectors
  const projectsRaw = await prisma.project.findMany({
    where: { workspaceId: wid, status: { not: 'archived' } },
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' },
  });

  // All open top-level tasks in the workspace (no assignee filter — subtask
  // generator needs to see any task, not just ones assigned to the viewer)
  const tasksRaw = await prisma.task.findMany({
    where: {
      workspaceId:  wid,
      status:       { notIn: ['done', 'backlog'] },
      parentTaskId: null,
    },
    select: { id: true, title: true, priority: true, status: true, dueDate: true, projectId: true, project: { select: { name: true } } },
    orderBy: { dueDate: { sort: 'asc', nulls: 'last' } },
    take: 200,
  });

  // Team members (for Team plan tools)
  const membersRaw = plan === 'team'
    ? await prisma.workspaceMember.findMany({
        where: { workspaceId: wid },
        select: { userId: true, user: { select: { fullName: true, email: true, avatarUrl: true } } },
      })
    : [];

  const projects = projectsRaw.map((p) => ({
    id: p.id, name: p.name, color: p.color,
  }));

  const tasks = tasksRaw.map((t) => ({
    id:           t.id,
    title:        t.title,
    priority:     t.priority,
    status:       t.status,
    due_date:     t.dueDate ? t.dueDate.toISOString() : null,
    project_id:   t.projectId,
    project_name: t.project?.name ?? null,
  }));

  const members = membersRaw.map((m) => ({
    id:        m.userId,
    full_name: m.user.fullName,
    email:     m.user.email,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        subtitle="AI-powered tools to boost your productivity"
      />
      <AIHub
        plan={plan}
        usageThisMonth={usageCount}
        projects={projects}
        tasks={tasks}
        members={members}
      />
    </div>
  );
}
