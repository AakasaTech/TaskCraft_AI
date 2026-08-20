// Inbound webhook from SupportCraft AI.
// SupportCraft calls this URL with ticket events; we verify the HMAC signature
// and create/update tasks accordingly.
//
// Webhook URL format (shown to user in integration settings):
//   POST /api/supportcraft/webhook?workspace_id={uuid}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { TICKET_TO_TASK } from '@/lib/supportcraft';
import { notifySupportTicketTaskCreated } from '@/lib/notifications';

export const runtime = 'nodejs';

interface TicketEvent {
  event:     'ticket.created' | 'ticket.status_changed' | 'ticket.updated';
  ticket_id: string;
  ticket: {
    id:          string;
    number:      string;
    title:       string;
    description: string;
    status:      string;
    priority:    string;
    client_id:   string;
    client_name: string;
    url:         string;
  };
  previous?: { status?: string };
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) return Response.json({ error: 'Missing workspace_id' }, { status: 400 });

  const rawBody = await req.text();

  // Load integration settings
  const settings = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'supportcraft' } },
    select: { config: true, enabled: true },
  });

  if (!settings?.enabled) {
    return Response.json({ error: 'Integration not enabled' }, { status: 403 });
  }

  const cfg           = settings.config as Record<string, unknown>;
  const webhookSecret = cfg.webhook_secret as string | undefined;

  // Verify HMAC signature (X-SupportCraft-Signature: sha256={hex})
  if (webhookSecret) {
    const sigHeader = req.headers.get('x-supportcraft-signature') ?? '';
    const expected  = `sha256=${createHmac('sha256', webhookSecret).update(rawBody).digest('hex')}`;
    try {
      const a = Buffer.from(sigHeader);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return Response.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: TicketEvent;
  try {
    payload = JSON.parse(rawBody) as TicketEvent;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event, ticket } = payload;

  if (event === 'ticket.created' && cfg.auto_create_tasks) {
    await handleTicketCreated(workspaceId, ticket, cfg);
  }

  if (event === 'ticket.status_changed' || event === 'ticket.updated') {
    await handleTicketUpdated(workspaceId, ticket);
  }

  return Response.json({ ok: true });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleTicketCreated(
  workspaceId: string,
  ticket: TicketEvent['ticket'],
  cfg: Record<string, unknown>,
) {
  // Skip if already linked
  const existing = await prisma.supportTicketLink.findUnique({
    where: { workspaceId_supportcraftTicketId: { workspaceId, supportcraftTicketId: ticket.id } },
    select: { id: true },
  });

  if (existing) return;

  // Get workspace owner to use as task creator
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, role: 'owner' },
    select: { userId: true },
  });

  if (!member) return;

  const priorityMap: Record<string, string> = {
    low: 'low', normal: 'medium', high: 'high', urgent: 'urgent',
  };
  const taskStatus = TICKET_TO_TASK[ticket.status as keyof typeof TICKET_TO_TASK] ?? 'todo';

  const task = await prisma.task.create({
    data: {
      workspaceId,
      projectId:   (cfg.default_project_id as string | null) ?? null,
      title:       `[${ticket.number}] ${ticket.title}`,
      description: `Support ticket from ${ticket.client_name}\n\n${ticket.url}`,
      status:      taskStatus,
      priority:    priorityMap[ticket.priority] ?? 'medium',
      createdById: member.userId,
      billable:    false,
    },
  });

  await prisma.supportTicketLink.create({
    data: {
      workspaceId,
      taskId:               task.id,
      supportcraftTicketId: ticket.id,
      ticketTitle:          ticket.title,
      ticketUrl:            ticket.url,
      syncStatus:           'synced',
      createdById:          member.userId,
    },
  });

  notifySupportTicketTaskCreated({
    workspaceId,
    userId:      member.userId,
    taskTitle:   task.title,
    taskId:      task.id,
    ticketTitle: ticket.title,
  }).catch(console.error);
}

async function handleTicketUpdated(workspaceId: string, ticket: TicketEvent['ticket']) {
  // Find linked task
  const link = await prisma.supportTicketLink.findUnique({
    where: { workspaceId_supportcraftTicketId: { workspaceId, supportcraftTicketId: ticket.id } },
    select: { id: true, taskId: true },
  });

  if (!link) return;

  // Update the link's cached ticket info
  await prisma.supportTicketLink.update({
    where: { id: link.id },
    data: {
      ticketTitle: ticket.title,
      ticketUrl:   ticket.url,
      syncStatus:  'synced',
    },
  });

  // Map ticket status → task status and update task
  const newTaskStatus = TICKET_TO_TASK[ticket.status as keyof typeof TICKET_TO_TASK];
  if (newTaskStatus) {
    await prisma.task.update({
      where: { id: link.taskId },
      data: {
        status: newTaskStatus,
        ...(newTaskStatus === 'done' ? { completedAt: new Date() } : {}),
      },
    });
  }
}
