import { requireAuth } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/shared/AppShell';
import { getEffectivePlan } from '@/lib/plan-gates';
import { SessionTimeout } from '@/components/shared/SessionTimeout';
import type { RunningTimer } from '@/app/(app)/time/_types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await requireAuth();

  // Fetch running timer for header badge
  let runningTimer: RunningTimer | null = null;
  const runningEntry = await prisma.timeEntry.findFirst({
    where: {
      userId: currentUser.profile.id,
      workspaceId: currentUser.workspace.id,
      endTime: null,
    },
    include: {
      task: { select: { title: true } },
      project: { select: { name: true, color: true } },
    },
  });

  if (runningEntry) {
    runningTimer = {
      id:            runningEntry.id,
      description:   runningEntry.description,
      start_time:    runningEntry.startTime.toISOString(),
      task_id:       runningEntry.taskId,
      task_title:    runningEntry.task?.title ?? null,
      project_id:    runningEntry.projectId,
      project_name:  runningEntry.project?.name ?? null,
      project_color: runningEntry.project?.color ?? null,
      billable:      runningEntry.billable,
      hourly_rate:   runningEntry.hourlyRate ? Number(runningEntry.hourlyRate) : null,
    };
  }

  return (
    <>
      <SessionTimeout />
      <AppShell
        user={{
          full_name: currentUser.profile.fullName,
          avatar_url: currentUser.profile.avatarUrl,
          email: currentUser.email,
          plan: getEffectivePlan(
            currentUser.profile.plan as import('@/lib/types').Plan,
            currentUser.profile.planExpiresAt?.toISOString() ?? null,
          ),
        }}
        userId={currentUser.id}
        runningTimer={runningTimer}
      >
        {children}
      </AppShell>
    </>
  );
}
