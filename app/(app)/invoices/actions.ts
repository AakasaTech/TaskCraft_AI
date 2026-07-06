'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillCraftService, type CreateInvoicePayload, type InvoiceLineItem } from '@/lib/billcraft';
import type { TimeEntryWithRelations } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  return { supabase, user, workspaceId: member?.workspace_id ?? null };
}

// ── Fetch BillCraft clients (called from wizard step 1) ───────────────────────

export async function getBillCraftClients() {
  const { supabase, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const { data: settings } = await supabase
    .from('integration_settings')
    .select('config, enabled')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'billcraft')
    .single();

  if (!settings?.enabled) return { error: 'BillCraft is not connected. Configure it in Integrations → BillCraft.' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new BillCraftService(cfg.api_key ?? '', cfg.api_url);

  try {
    const clients = await svc.getClients();
    return { data: { clients } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch BillCraft clients' };
  }
}

// ── Fetch unbilled time entries for review (step 3) ───────────────────────────

export async function fetchUnbilledEntries(params: {
  projectId?: string | null;
  dateFrom:   string;
  dateTo:     string;
}) {
  const { supabase, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  let query = supabase
    .from('time_entries')
    .select(`
      *,
      task:tasks(id, title),
      project:projects(id, name, color)
    `)
    .eq('workspace_id', workspaceId)
    .eq('billable', true)
    .eq('invoice_status', 'not_invoiced')
    .not('end_time', 'is', null)
    .gte('start_time', `${params.dateFrom}T00:00:00.000Z`)
    .lte('start_time', `${params.dateTo}T23:59:59.999Z`)
    .order('start_time', { ascending: false });

  if (params.projectId) {
    query = query.eq('project_id', params.projectId);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  const entries = (data ?? []) as TimeEntryWithRelations[];
  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const totalHours   = totalMinutes / 60;
  const totalAmount  = entries.reduce((s, e) => {
    const hrs  = (e.duration_minutes ?? 0) / 60;
    const rate = e.hourly_rate ?? 0;
    return s + hrs * rate;
  }, 0);

  return { data: { entries, totalHours, totalAmount } };
}

// ── Create invoice ────────────────────────────────────────────────────────────

export type InvoiceGrouping = 'by_task' | 'flat';

export interface CreateInvoiceInput {
  billcraft_client_id:   string;
  billcraft_client_name: string;
  project_id:            string | null;
  date_from:             string;
  date_to:               string;
  entry_ids:             string[];
  title:                 string;
  notes:                 string;
  due_date:              string | null;
  grouping:              InvoiceGrouping;
  currency:              string;
  default_rate:          number;
}

export async function createInvoice(input: CreateInvoiceInput) {
  const { supabase, user, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  // 1. Load selected time entries
  const { data: rows, error: entErr } = await supabase
    .from('time_entries')
    .select(`
      *,
      task:tasks(id, title)
    `)
    .in('id', input.entry_ids)
    .eq('workspace_id', workspaceId)
    .eq('invoice_status', 'not_invoiced');

  if (entErr) return { error: entErr.message };
  if (!rows || rows.length === 0) return { error: 'No eligible entries found' };

  // 2. Build line items according to grouping
  const lineItems = buildLineItems(rows as TimeEntryWithRelations[], input.grouping, input.default_rate);
  const totalHours  = rows.reduce((s, e) => s + (e.duration_minutes ?? 0) / 60, 0);
  const totalAmount = lineItems.reduce((s, li) => s + li.amount, 0);

  // 3. Call BillCraft API
  const { data: settings } = await supabase
    .from('integration_settings')
    .select('config, enabled')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'billcraft')
    .single();

  if (!settings?.enabled) return { error: 'BillCraft is not connected' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new BillCraftService(cfg.api_key ?? '', cfg.api_url);

  const payload: CreateInvoicePayload = {
    billcraft_client_id: input.billcraft_client_id,
    title:               input.title,
    due_date:            input.due_date,
    currency:            input.currency,
    notes:               input.notes || undefined,
    line_items:          lineItems,
    metadata: {
      source:       'taskcraft',
      workspace_id: workspaceId,
      project_id:   input.project_id,
      date_from:    input.date_from,
      date_to:      input.date_to,
      entry_ids:    input.entry_ids,
    },
  };

  let bcInvoice;
  try {
    bcInvoice = await svc.createInvoice(payload);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'BillCraft API error' };
  }

  // 4. Save to invoices_sync
  const { data: syncRecord, error: syncErr } = await supabase
    .from('invoices_sync')
    .insert({
      workspace_id:         workspaceId,
      project_id:           input.project_id,
      user_id:              user.id,
      billcraft_invoice_id: bcInvoice.id,
      invoice_number:       bcInvoice.number,
      date_from:            input.date_from,
      date_to:              input.date_to,
      entry_count:          rows.length,
      notes:                input.notes || null,
      total_hours:          Math.round(totalHours * 100) / 100,
      total_amount:         Math.round(totalAmount * 100) / 100,
      currency:             input.currency,
      status:               'synced',
      synced_at:            new Date().toISOString(),
    })
    .select()
    .single();

  if (syncErr) return { error: syncErr.message };

  // 5. Mark time entries as invoiced
  await supabase
    .from('time_entries')
    .update({ invoice_status: 'invoiced', invoice_sync_id: syncRecord.id })
    .in('id', input.entry_ids);

  return { data: { sync: syncRecord, invoice: bcInvoice } };
}

// ── Line item builder ─────────────────────────────────────────────────────────

function buildLineItems(
  entries: TimeEntryWithRelations[],
  grouping: InvoiceGrouping,
  defaultRate: number,
): InvoiceLineItem[] {
  if (grouping === 'flat') {
    return entries.map((e) => {
      const hrs  = (e.duration_minutes ?? 0) / 60;
      const rate = e.hourly_rate ?? defaultRate;
      return {
        description: e.task?.title ?? e.description ?? 'Time entry',
        quantity:    Math.round(hrs * 100) / 100,
        rate,
        amount:      Math.round(hrs * rate * 100) / 100,
      };
    });
  }

  // by_task: group entries by task (or description if no task)
  const grouped = new Map<string, { description: string; minutes: number; rate: number }>();

  for (const e of entries) {
    const key  = e.task_id ?? `desc:${e.description ?? 'misc'}`;
    const desc = e.task?.title ?? e.description ?? 'Miscellaneous';
    const rate = e.hourly_rate ?? defaultRate;
    const existing = grouped.get(key);
    if (existing) {
      existing.minutes += e.duration_minutes ?? 0;
    } else {
      grouped.set(key, { description: desc, minutes: e.duration_minutes ?? 0, rate });
    }
  }

  return Array.from(grouped.values()).map(({ description, minutes, rate }) => {
    const hrs = minutes / 60;
    return {
      description,
      quantity: Math.round(hrs * 100) / 100,
      rate,
      amount:   Math.round(hrs * rate * 100) / 100,
    };
  });
}
