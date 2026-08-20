'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';

export async function startTimer(input: {
  description?: string;
  task_id?: string;
  project_id?: string;
  billable?: boolean;
  hourly_rate?: number;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Unauthorized');

  const wid = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  const now = new Date();

  // Stop any currently running timer for this user
  const running = await prisma.timeEntry.findFirst({
    where: {
      userId: uid,
      workspaceId: wid,
      endTime: null,
    },
  });

  if (running) {
    const durationMinutes = Math.max(1, Math.round((now.getTime() - running.startTime.getTime()) / 60000));
    await prisma.timeEntry.update({
      where: { id: running.id },
      data: {
        endTime: now,
        durationMinutes,
      },
    });
  }

  const newEntry = await prisma.timeEntry.create({
    data: {
      workspaceId: wid,
      userId:      uid,
      description: input.description || null,
      taskId:      input.task_id || null,
      projectId:   input.project_id || null,
      billable:    input.billable ?? false,
      hourlyRate:  input.hourly_rate ?? null,
      startTime:   now,
      source:      'timer',
    },
    select: { id: true, startTime: true },
  });

  revalidatePath('/time');
  revalidatePath('/dashboard');
  return { id: newEntry.id, start_time: newEntry.startTime.toISOString() };
}

export async function stopTimer(entryId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Unauthorized');

  const uid = currentUser.profile.id;
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId: uid },
  });

  if (!entry) throw new Error('Time entry not found');

  const now = new Date();
  const durationMinutes = Math.max(1, Math.round((now.getTime() - entry.startTime.getTime()) / 60000));

  await prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      endTime: now,
      durationMinutes,
    },
  });

  revalidatePath('/time');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function createManualEntry(input: {
  description?: string;
  task_id?: string;
  project_id?: string;
  start_time: string;
  end_time: string;
  billable?: boolean;
  hourly_rate?: number;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Unauthorized');

  const wid = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  const start = new Date(input.start_time);
  const end = new Date(input.end_time);
  const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

  await prisma.timeEntry.create({
    data: {
      workspaceId:     wid,
      userId:          uid,
      description:     input.description || null,
      taskId:          input.task_id || null,
      projectId:       input.project_id || null,
      startTime:       start,
      endTime:         end,
      durationMinutes,
      billable:        input.billable ?? false,
      hourlyRate:      input.hourly_rate ?? null,
      source:          'manual',
    },
  });

  revalidatePath('/time');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function updateTimeEntry(
  id: string,
  input: {
    description?: string;
    task_id?: string | null;
    project_id?: string | null;
    start_time?: string;
    end_time?: string;
    billable?: boolean;
    hourly_rate?: number | null;
  },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Unauthorized');

  const uid = currentUser.profile.id;
  const data: Record<string, unknown> = {};

  if (input.description !== undefined) data.description = input.description || null;
  if (input.task_id     !== undefined) data.taskId      = input.task_id || null;
  if (input.project_id  !== undefined) data.projectId   = input.project_id || null;
  if (input.billable    !== undefined) data.billable    = input.billable;
  if (input.hourly_rate !== undefined) data.hourlyRate  = input.hourly_rate ?? null;

  if (input.start_time) data.startTime = new Date(input.start_time);
  if (input.end_time)   data.endTime   = new Date(input.end_time);

  if (input.start_time && input.end_time) {
    const start = new Date(input.start_time);
    const end = new Date(input.end_time);
    data.durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  }

  await prisma.timeEntry.updateMany({
    where: { id, userId: uid },
    data,
  });

  revalidatePath('/time');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function deleteTimeEntry(id: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Unauthorized');

  const uid = currentUser.profile.id;

  await prisma.timeEntry.deleteMany({
    where: { id, userId: uid },
  });

  revalidatePath('/time');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}
