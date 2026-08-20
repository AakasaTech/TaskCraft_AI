'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { SupportCraftService, TASK_TO_TICKET } from '@/lib/supportcraft';
import type { TaskStatus } from '@/lib/types';

async function getScService(workspaceId: string) {
  const setting = await prisma.integrationSetting.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId,
        integrationType: 'supportcraft',
      },
    },
  });

  if (!setting?.enabled) return null;
  const cfg = setting.config as { api_key?: string; api_url?: string };
  return new SupportCraftService(cfg.api_key ?? '', cfg.api_url);
}

// ── Add internal note to the linked SupportCraft ticket ───────────────────────

export async function addNoteToTicket(taskId: string, note: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const link = await prisma.supportTicketLink.findFirst({
    where: { taskId },
  });

  if (!link) return { error: 'No ticket linked to this task' };

  const svc = await getScService(link.workspaceId);
  if (!svc) return { error: 'SupportCraft not connected' };

  try {
    await svc.addNote(link.supportcraftTicketId, note, true);
    return { data: { ok: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add note' };
  }
}

// ── Sync task status back to the linked ticket ────────────────────────────────

export async function syncTaskStatusToTicket(taskId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { status: true, workspaceId: true },
  });

  if (!task) return { error: 'Task not found' };

  const setting = await prisma.integrationSetting.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId: task.workspaceId,
        integrationType: 'supportcraft',
      },
    },
  });

  const cfg = (setting?.config ?? {}) as Record<string, unknown>;
  if (!setting?.enabled || !cfg.sync_status_back) {
    return { data: { skipped: true } };
  }

  const link = await prisma.supportTicketLink.findFirst({
    where: { taskId },
  });

  if (!link) return { data: { skipped: true } };

  const ticketStatus = TASK_TO_TICKET[task.status as TaskStatus];
  if (!ticketStatus) return { data: { skipped: true } };

  const svc = await getScService(task.workspaceId);
  if (!svc) return { data: { skipped: true } };

  try {
    await svc.updateTicketStatus(link.supportcraftTicketId, ticketStatus);

    await prisma.supportTicketLink.update({
      where: { id: link.id },
      data: {
        syncStatus: 'synced',
        updatedAt: new Date(),
      },
    });

    return { data: { ok: true, ticketStatus } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Status sync failed' };
  }
}
