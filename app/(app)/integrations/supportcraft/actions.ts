'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { SupportCraftService, TICKET_TO_TASK, type TicketStatus } from '@/lib/supportcraft';
import { notifySupportTicketTaskCreated } from '@/lib/notifications';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getContext() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: currentUser.profile.id, role: { in: ['owner', 'admin'] } },
    select: { workspaceId: true },
  });

  return { currentUser, workspaceId: member?.workspaceId ?? null };
}

// ── Integration settings ──────────────────────────────────────────────────────

export async function saveSupportCraftSettings(formData: {
  api_key:           string;
  api_url:           string;
  auto_create_tasks: boolean;
  default_project_id:string;
  sync_status_back:  boolean;
}) {
  const { currentUser, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  // Preserve existing webhook_secret if already set
  const existing = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
    select: { config: true },
  });

  const existingCfg   = (existing?.config ?? {}) as Record<string, unknown>;
  const webhookSecret = (existingCfg.webhook_secret as string | undefined)
    ?? randomBytes(24).toString('hex');

  const config = {
    api_key:            formData.api_key.trim(),
    api_url:            formData.api_url.trim() || 'https://supportcraft.aakasa.dev/api/v1',
    webhook_secret:     webhookSecret,
    auto_create_tasks:  formData.auto_create_tasks,
    default_project_id: formData.default_project_id || null,
    sync_status_back:   formData.sync_status_back,
  };

  try {
    await prisma.integrationSetting.upsert({
      where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
      create: {
        workspaceId,
        integrationType: 'supportcraft',
        enabled:         !!config.api_key,
        config,
        createdById:     currentUser.profile.id,
      },
      update: {
        enabled: !!config.api_key,
        config,
      },
    });
    return { data: { ok: true, webhook_secret: webhookSecret } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save settings' };
  }
}

export async function testSupportCraftConnection(apiKey?: string, apiUrl?: string) {
  const { workspaceId } = await getContext();

  // If called with explicit values (pre-save test), use those directly
  if (apiKey) {
    const svc = new SupportCraftService(apiKey, apiUrl || 'https://supportcraft.aakasa.dev/api/v1');
    return svc.testConnection();
  }

  if (!workspaceId) return { error: 'No workspace found' };

  // Otherwise fall back to saved settings
  const settings = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
    select: { config: true },
  });

  if (!settings) return { error: 'SupportCraft not configured' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new SupportCraftService(cfg.api_key ?? '', cfg.api_url);
  return svc.testConnection();
}

export async function regenerateWebhookSecret() {
  const { workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const existing = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
    select: { config: true },
  });

  if (!existing) return { error: 'SupportCraft not configured' };

  const newSecret = randomBytes(24).toString('hex');
  const cfg = { ...(existing.config as Record<string, unknown>), webhook_secret: newSecret };

  try {
    await prisma.integrationSetting.update({
      where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
      data:  { config: cfg },
    });
    return { data: { webhook_secret: newSecret } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to regenerate secret' };
  }
}

export async function disconnectSupportCraft() {
  const { workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  try {
    await prisma.integrationSetting.update({
      where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
      data:  { enabled: false, config: {} },
    });
    return { data: { ok: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to disconnect' };
  }
}

// ── Create task from support ticket ──────────────────────────────────────────

export async function createTaskFromTicket(input: {
  ticketId:       string;
  ticketNumber:   string;
  ticketTitle:    string;
  ticketUrl:      string;
  ticketStatus:   TicketStatus;
  ticketPriority: string;
  clientName:     string;
  projectId?:     string | null;
}) {
  const { currentUser, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  // Check not already linked
  const existing = await prisma.supportTicketLink.findUnique({
    where: { workspaceId_supportcraftTicketId: { workspaceId, supportcraftTicketId: input.ticketId } },
    select: { id: true },
  });

  if (existing) {
    return { error: `Ticket ${input.ticketNumber} is already linked to a task` };
  }

  // Map ticket priority to task priority
  const priorityMap: Record<string, string> = {
    low: 'low', normal: 'medium', high: 'high', urgent: 'urgent',
  };

  try {
    const task = await prisma.task.create({
      data: {
        workspaceId,
        projectId:   input.projectId ?? null,
        title:       `[${input.ticketNumber}] ${input.ticketTitle}`,
        description: `Support ticket from ${input.clientName}\n\n${input.ticketUrl}`,
        status:      TICKET_TO_TASK[input.ticketStatus] ?? 'todo',
        priority:    priorityMap[input.ticketPriority] ?? 'medium',
        createdById: currentUser.profile.id,
        billable:    false,
      },
    });

    try {
      await prisma.supportTicketLink.create({
        data: {
          workspaceId,
          taskId:               task.id,
          supportcraftTicketId: input.ticketId,
          ticketTitle:          input.ticketTitle,
          ticketUrl:            input.ticketUrl,
          syncStatus:           'linked',
          createdById:          currentUser.profile.id,
        },
      });
    } catch (linkErr) {
      await prisma.task.delete({ where: { id: task.id } });
      return { error: linkErr instanceof Error ? linkErr.message : 'Failed to link ticket' };
    }

    // Notify the task creator (themselves) about the new linked task
    notifySupportTicketTaskCreated({
      workspaceId,
      userId:      currentUser.profile.id,
      taskTitle:   task.title,
      taskId:      task.id,
      ticketTitle: input.ticketTitle,
    }).catch(console.error);

    return { data: { task } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create task' };
  }
}

// ── Load recent tickets from SupportCraft ─────────────────────────────────────

export async function loadRecentTickets() {
  const { workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const settings = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
    select: { config: true, enabled: true },
  });

  if (!settings?.enabled) return { error: 'SupportCraft not connected' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new SupportCraftService(cfg.api_key ?? '', cfg.api_url);

  try {
    const tickets = await svc.getTickets({ limit: 10 });

    // Find which tickets are already linked
    const ticketIds = tickets.map((t) => t.id);
    const linked = await prisma.supportTicketLink.findMany({
      where: { workspaceId, supportcraftTicketId: { in: ticketIds } },
      select: { supportcraftTicketId: true },
    });

    const linkedSet = new Set(linked.map((l) => l.supportcraftTicketId));

    return { data: { tickets, linkedSet: Array.from(linkedSet) } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load tickets' };
  }
}
