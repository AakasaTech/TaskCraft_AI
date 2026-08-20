import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { TimeClient } from './_components/TimeClient';
import type { TimeEntryRich, RunningTimer, TimeProject, TimeTask } from './_types';

export const metadata: Metadata = { title: 'Time Tracking' };

export default async function TimePage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const wid = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  // Last 30 days for weekly navigation
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [entriesRes, runningRes, projectsRes, tasksRes] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        userId: uid,
        workspaceId: wid,
        endTime: { not: null },
        startTime: { gte: since },
      },
      include: {
        task: { select: { title: true } },
        project: {
          select: {
            name: true,
            color: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { startTime: 'desc' },
    }),

    prisma.timeEntry.findFirst({
      where: {
        userId: uid,
        workspaceId: wid,
        endTime: null,
      },
      include: {
        task: { select: { title: true } },
        project: { select: { name: true, color: true } },
      },
    }),

    prisma.project.findMany({
      where: {
        workspaceId: wid,
        status: { not: 'archived' },
      },
      select: {
        id: true,
        name: true,
        color: true,
        hourlyRate: true,
        client: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    }),

    prisma.task.findMany({
      where: {
        workspaceId: wid,
        parentTaskId: null,
        status: { not: 'done' },
      },
      select: { id: true, title: true, projectId: true },
      orderBy: { title: 'asc' },
    }),
  ]);

  // Shape time entries
  const entries: TimeEntryRich[] = entriesRes.map((e) => {
    return {
      id:               e.id,
      workspace_id:     e.workspaceId,
      task_id:          e.taskId,
      project_id:       e.projectId,
      user_id:          e.userId,
      description:      e.description,
      start_time:       e.startTime.toISOString(),
      end_time:         e.endTime?.toISOString() ?? null,
      duration_minutes: e.durationMinutes,
      billable:         e.billable,
      hourly_rate:      e.hourlyRate ? Number(e.hourlyRate) : null,
      invoice_status:   e.invoiceStatus as TimeEntryRich['invoice_status'],
      source:           e.source as TimeEntryRich['source'],
      created_at:       e.createdAt.toISOString(),
      task_title:       e.task?.title ?? null,
      project_name:     e.project?.name ?? null,
      project_color:    e.project?.color ?? null,
      client_name:      e.project?.client?.name ?? null,
    };
  });

  // Shape running timer
  let running: RunningTimer | null = null;
  if (runningRes) {
    running = {
      id:            runningRes.id,
      description:   runningRes.description,
      start_time:    runningRes.startTime.toISOString(),
      task_id:       runningRes.taskId,
      task_title:    runningRes.task?.title ?? null,
      project_id:    runningRes.projectId,
      project_name:  runningRes.project?.name ?? null,
      project_color: runningRes.project?.color ?? null,
      billable:      runningRes.billable,
      hourly_rate:   runningRes.hourlyRate ? Number(runningRes.hourlyRate) : null,
    };
  }

  // Shape projects
  const projects: TimeProject[] = projectsRes.map((p) => ({
    id:          p.id,
    name:        p.name,
    color:       p.color,
    hourly_rate: p.hourlyRate ? Number(p.hourlyRate) : null,
    client_name: p.client?.name ?? null,
  }));

  // Shape tasks
  const tasks: TimeTask[] = tasksRes.map((t) => ({
    id:         t.id,
    title:      t.title,
    project_id: t.projectId,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time Tracking"
        subtitle="Log and manage your billable hours"
      />
      <TimeClient
        entries={entries}
        running={running}
        projects={projects}
        tasks={tasks}
      />
    </div>
  );
}
