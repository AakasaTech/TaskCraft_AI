import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { CalendarClient } from './_components/CalendarClient';
import type { CalendarTask } from './_components/CalendarClient';
import type { TaskStatus, TaskPriority } from '@/lib/types';

export const metadata: Metadata = { title: 'Calendar' };

export default async function CalendarPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const wid = currentUser.workspace.id;

  // Fetch tasks with a dueDate
  const tasksData = await prisma.task.findMany({
    where: {
      workspaceId:  wid,
      dueDate:      { not: null },
      parentTaskId: null,
    },
    include: {
      project: { select: { name: true, color: true } },
    },
    orderBy: { dueDate: 'asc' },
  });

  const tasks: CalendarTask[] = tasksData.map((t) => ({
    id:            t.id,
    title:         t.title,
    status:        t.status as TaskStatus,
    priority:      t.priority as TaskPriority,
    due_date:      t.dueDate!.toISOString().split('T')[0],
    project_name:  t.project?.name ?? null,
    project_color: t.project?.color ?? null,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Calendar"
        subtitle="Tasks by due date"
      />
      <CalendarClient tasks={tasks} />
    </div>
  );
}
