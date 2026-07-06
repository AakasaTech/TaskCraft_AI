'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SupportCraftService, TASK_TO_TICKET } from '@/lib/supportcraft';
import type { TaskStatus } from '@/lib/types';

async function getScService(workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('integration_settings')
    .select('config, enabled')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft')
    .single();

  if (!data?.enabled) return null;
  const cfg = data.config as { api_key?: string; api_url?: string };
  return new SupportCraftService(cfg.api_key ?? '', cfg.api_url);
}

// ── Add internal note to the linked SupportCraft ticket ───────────────────────

export async function addNoteToTicket(taskId: string, note: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Find the ticket link
  const { data: link } = await supabase
    .from('support_ticket_links')
    .select('supportcraft_ticket_id, workspace_id')
    .eq('task_id', taskId)
    .single();

  if (!link) return { error: 'No ticket linked to this task' };

  const svc = await getScService(link.workspace_id);
  if (!svc) return { error: 'SupportCraft not connected' };

  try {
    await svc.addNote(link.supportcraft_ticket_id, note, true);
    return { data: { ok: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add note' };
  }
}

// ── Sync task status back to the linked ticket ────────────────────────────────

export async function syncTaskStatusToTicket(taskId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Get current task status
  const { data: task } = await supabase
    .from('tasks')
    .select('status, workspace_id')
    .eq('id', taskId)
    .single();

  if (!task) return { error: 'Task not found' };

  // Check sync_status_back option
  const { data: settings } = await supabase
    .from('integration_settings')
    .select('config, enabled')
    .eq('workspace_id', task.workspace_id)
    .eq('integration_type', 'supportcraft')
    .single();

  const cfg = (settings?.config ?? {}) as Record<string, unknown>;
  if (!settings?.enabled || !cfg.sync_status_back) {
    return { data: { skipped: true } };
  }

  // Find the ticket link
  const { data: link } = await supabase
    .from('support_ticket_links')
    .select('id, supportcraft_ticket_id')
    .eq('task_id', taskId)
    .single();

  if (!link) return { data: { skipped: true } };

  const ticketStatus = TASK_TO_TICKET[task.status as TaskStatus];
  if (!ticketStatus) return { data: { skipped: true } };

  const svc = await getScService(task.workspace_id);
  if (!svc) return { data: { skipped: true } };

  try {
    await svc.updateTicketStatus(link.supportcraft_ticket_id, ticketStatus);

    await supabase
      .from('support_ticket_links')
      .update({
        ticket_status:  ticketStatus,
        sync_status:    'synced',
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', link.id);

    return { data: { ok: true, ticketStatus } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Status sync failed' };
  }
}
