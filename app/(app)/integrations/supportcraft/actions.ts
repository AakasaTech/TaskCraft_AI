'use server';

import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SupportCraftService, TICKET_TO_TASK, type TicketStatus } from '@/lib/supportcraft';
import { notifySupportTicketTaskCreated } from '@/lib/notifications';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .single();

  return { supabase, user, workspaceId: member?.workspace_id ?? null };
}

// ── Integration settings ──────────────────────────────────────────────────────

export async function saveSupportCraftSettings(formData: {
  api_key:           string;
  api_url:           string;
  auto_create_tasks: boolean;
  default_project_id:string;
  sync_status_back:  boolean;
}) {
  const { supabase, user, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  // Preserve existing webhook_secret if already set
  const { data: existing } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft')
    .single();

  const existingCfg  = (existing?.config ?? {}) as Record<string, unknown>;
  const webhookSecret = (existingCfg.webhook_secret as string | undefined)
    ?? randomBytes(24).toString('hex');

  const config = {
    api_key:            formData.api_key.trim(),
    api_url:            formData.api_url.trim() || 'https://app.supportcraft.ai/api',
    webhook_secret:     webhookSecret,
    auto_create_tasks:  formData.auto_create_tasks,
    default_project_id: formData.default_project_id || null,
    sync_status_back:   formData.sync_status_back,
  };

  const { error } = await supabase
    .from('integration_settings')
    .upsert(
      {
        workspace_id:     workspaceId,
        integration_type: 'supportcraft',
        enabled:          !!config.api_key,
        config,
        created_by:       user.id,
      },
      { onConflict: 'workspace_id,integration_type' },
    );

  if (error) return { error: error.message };
  return { data: { ok: true, webhook_secret: webhookSecret } };
}

export async function testSupportCraftConnection() {
  const { supabase, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const { data: settings } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft')
    .single();

  if (!settings) return { error: 'SupportCraft not configured' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new SupportCraftService(cfg.api_key ?? '', cfg.api_url);
  return svc.testConnection();
}

export async function regenerateWebhookSecret() {
  const { supabase, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const { data: existing } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft')
    .single();

  if (!existing) return { error: 'SupportCraft not configured' };

  const newSecret = randomBytes(24).toString('hex');
  const cfg = { ...(existing.config as Record<string, unknown>), webhook_secret: newSecret };

  const { error } = await supabase
    .from('integration_settings')
    .update({ config: cfg })
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft');

  if (error) return { error: error.message };
  return { data: { webhook_secret: newSecret } };
}

export async function disconnectSupportCraft() {
  const { supabase, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const { error } = await supabase
    .from('integration_settings')
    .update({ enabled: false, config: {} })
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft');

  if (error) return { error: error.message };
  return { data: { ok: true } };
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
  const { supabase, user, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  // Check not already linked
  const { data: existing } = await supabase
    .from('support_ticket_links')
    .select('id, task_id')
    .eq('workspace_id', workspaceId)
    .eq('supportcraft_ticket_id', input.ticketId)
    .single();

  if (existing) {
    return { error: `Ticket ${input.ticketNumber} is already linked to a task` };
  }

  // Map ticket priority to task priority
  const priorityMap: Record<string, string> = {
    low: 'low', normal: 'medium', high: 'high', urgent: 'urgent',
  };

  // Create the task
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      project_id:   input.projectId ?? null,
      title:        `[${input.ticketNumber}] ${input.ticketTitle}`,
      description:  `Support ticket from ${input.clientName}\n\n${input.ticketUrl}`,
      status:       TICKET_TO_TASK[input.ticketStatus] ?? 'todo',
      priority:     priorityMap[input.ticketPriority] ?? 'medium',
      created_by:   user.id,
      billable:     false,
    })
    .select()
    .single();

  if (taskErr) return { error: taskErr.message };

  // Create the link
  const { error: linkErr } = await supabase
    .from('support_ticket_links')
    .insert({
      workspace_id:           workspaceId,
      task_id:                task.id,
      supportcraft_ticket_id: input.ticketId,
      ticket_title:           input.ticketTitle,
      ticket_url:             input.ticketUrl,
      ticket_status:          input.ticketStatus,
      ticket_priority:        input.ticketPriority,
      client_name:            input.clientName,
      sync_status:            'linked',
      created_by:             user.id,
    });

  if (linkErr) {
    await supabase.from('tasks').delete().eq('id', task.id);
    return { error: linkErr.message };
  }

  // Notify the task creator (themselves) about the new linked task
  notifySupportTicketTaskCreated({
    workspaceId,
    userId:      user.id,
    taskTitle:   task.title,
    taskId:      task.id,
    ticketTitle: input.ticketTitle,
  }).catch(console.error);

  return { data: { task } };
}

// ── Load recent tickets from SupportCraft ─────────────────────────────────────

export async function loadRecentTickets() {
  const { supabase, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const { data: settings } = await supabase
    .from('integration_settings')
    .select('config, enabled')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft')
    .single();

  if (!settings?.enabled) return { error: 'SupportCraft not connected' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new SupportCraftService(cfg.api_key ?? '', cfg.api_url);

  try {
    const tickets = await svc.getTickets({ limit: 10 });

    // Find which tickets are already linked
    const ticketIds = tickets.map((t) => t.id);
    const { data: linked } = await supabase
      .from('support_ticket_links')
      .select('supportcraft_ticket_id, task_id')
      .eq('workspace_id', workspaceId)
      .in('supportcraft_ticket_id', ticketIds);

    const linkedSet = new Set((linked ?? []).map((l) => l.supportcraft_ticket_id));

    return { data: { tickets, linkedSet: Array.from(linkedSet) } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load tickets' };
  }
}
