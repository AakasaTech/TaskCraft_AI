// Inbound webhook from SupportCraft AI.
// SupportCraft calls this URL with ticket events; we verify the HMAC signature
// and create/update tasks accordingly.
//
// Webhook URL format (shown to user in integration settings):
//   POST /api/supportcraft/webhook?workspace_id={uuid}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { SupportCraftService, TICKET_TO_TASK, TASK_TO_TICKET } from '@/lib/supportcraft';
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
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('integration_settings')
    .select('config, enabled')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft')
    .single();

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
  const admin = createAdminClient();

  // Skip if already linked
  const { data: existing } = await admin
    .from('support_ticket_links')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('supportcraft_ticket_id', ticket.id)
    .single();

  if (existing) return;

  // Get workspace owner to use as task creator
  const { data: member } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .single();

  if (!member) return;

  const priorityMap: Record<string, string> = {
    low: 'low', normal: 'medium', high: 'high', urgent: 'urgent',
  };
  const taskStatus = TICKET_TO_TASK[ticket.status as keyof typeof TICKET_TO_TASK] ?? 'todo';

  const { data: task } = await admin
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      project_id:   (cfg.default_project_id as string | null) ?? null,
      title:        `[${ticket.number}] ${ticket.title}`,
      description:  `Support ticket from ${ticket.client_name}\n\n${ticket.url}`,
      status:       taskStatus,
      priority:     priorityMap[ticket.priority] ?? 'medium',
      created_by:   member.user_id,
      billable:     false,
    })
    .select()
    .single();

  if (!task) return;

  await admin.from('support_ticket_links').insert({
    workspace_id:           workspaceId,
    task_id:                task.id,
    supportcraft_ticket_id: ticket.id,
    ticket_title:           ticket.title,
    ticket_url:             ticket.url,
    ticket_status:          ticket.status,
    ticket_priority:        ticket.priority,
    client_name:            ticket.client_name,
    sync_status:            'synced',
    created_by:             member.user_id,
    last_synced_at:         new Date().toISOString(),
  });

  notifySupportTicketTaskCreated({
    workspaceId,
    userId:    member.user_id,
    taskTitle: task.title,
    taskId:    task.id,
    ticketTitle: ticket.title,
  }).catch(console.error);
}

async function handleTicketUpdated(workspaceId: string, ticket: TicketEvent['ticket']) {
  const admin = createAdminClient();

  // Find linked task
  const { data: link } = await admin
    .from('support_ticket_links')
    .select('id, task_id')
    .eq('workspace_id', workspaceId)
    .eq('supportcraft_ticket_id', ticket.id)
    .single();

  if (!link) return;

  // Update the link's cached ticket info
  await admin
    .from('support_ticket_links')
    .update({
      ticket_title:   ticket.title,
      ticket_url:     ticket.url,
      ticket_status:  ticket.status,
      ticket_priority:ticket.priority,
      client_name:    ticket.client_name,
      sync_status:    'synced',
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', link.id);

  // Map ticket status → task status and update task
  const newTaskStatus = TICKET_TO_TASK[ticket.status as keyof typeof TICKET_TO_TASK];
  if (newTaskStatus) {
    await admin
      .from('tasks')
      .update({
        status: newTaskStatus,
        ...(newTaskStatus === 'done' ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', link.task_id);
  }
}
