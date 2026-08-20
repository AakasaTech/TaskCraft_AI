'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { BillCraftService, type CreateInvoicePayload, type InvoiceLineItem } from '@/lib/billcraft';
import type { TimeEntryWithRelations } from '@/lib/types';

export async function getBillCraftClients() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const workspaceId = currentUser.workspace.id;

  const settings = await prisma.integrationSetting.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId,
        integrationType: 'billcraft',
      },
    },
  });

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

export async function fetchUnbilledEntries(params: {
  projectId?: string | null;
  dateFrom:   string;
  dateTo:     string;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const workspaceId = currentUser.workspace.id;

  const where: any = {
    workspaceId,
    billable: true,
    invoiceStatus: 'not_invoiced',
    endTime: { not: null },
    startTime: {
      gte: new Date(`${params.dateFrom}T00:00:00.000Z`),
      lte: new Date(`${params.dateTo}T23:59:59.999Z`),
    },
  };

  if (params.projectId) {
    where.projectId = params.projectId;
  }

  const rows = await prisma.timeEntry.findMany({
    where,
    include: {
      task: { select: { id: true, title: true } },
      project: { select: { id: true, name: true, color: true } },
    },
    orderBy: { startTime: 'desc' },
  });

  const entries = rows.map((e) => ({
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
    invoice_status:   e.invoiceStatus as any,
    invoice_sync_id:  null,
    source:           e.source as any,
    created_at:       e.createdAt.toISOString(),
    updated_at:       e.updatedAt.toISOString(),
    task:             e.task ? { id: e.task.id, title: e.task.title } : null,
    project:          e.project ? { id: e.project.id, name: e.project.name, color: e.project.color } : null,
  }));

  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
  const totalHours   = totalMinutes / 60;
  const totalAmount  = entries.reduce((s, e) => {
    const hrs  = (e.duration_minutes ?? 0) / 60;
    const rate = e.hourly_rate ?? 0;
    return s + hrs * rate;
  }, 0);

  return { data: { entries, totalHours, totalAmount } };
}

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
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const workspaceId = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  // 1. Load selected time entries
  const rows = await prisma.timeEntry.findMany({
    where: {
      id: { in: input.entry_ids },
      workspaceId,
      invoiceStatus: 'not_invoiced',
    },
    include: {
      task: { select: { id: true, title: true } },
    },
  });

  if (rows.length === 0) return { error: 'No eligible entries found' };

  const mappedEntries: TimeEntryWithRelations[] = rows.map((e) => ({
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
    invoice_status:   e.invoiceStatus as any,
    invoice_sync_id:  null,
    source:           e.source as any,
    created_at:       e.createdAt.toISOString(),
    updated_at:       e.updatedAt.toISOString(),
    task:             e.task ? { id: e.task.id, title: e.task.title } : null,
  }));

  // 2. Build line items according to grouping
  const lineItems = buildLineItems(mappedEntries, input.grouping, input.default_rate);
  const totalHours  = rows.reduce((s, e) => s + (e.durationMinutes ?? 0) / 60, 0);
  const totalAmount = lineItems.reduce((s, li) => s + li.amount, 0);

  // 3. Call BillCraft API
  const settings = await prisma.integrationSetting.findUnique({
    where: {
      workspaceId_integrationType: {
        workspaceId,
        integrationType: 'billcraft',
      },
    },
  });

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

  // 4. Save to invoicesSync and mark entries as invoiced in Prisma transaction
  const syncRecord = await prisma.$transaction(async (tx) => {
    const sync = await tx.invoicesSync.create({
      data: {
        workspaceId,
        projectId:           input.project_id,
        userId:              uid,
        billcraftInvoiceId:  bcInvoice.id,
        totalHours,
        totalAmount,
        currency:            input.currency,
        status:              'synced',
        syncedAt:            new Date(),
      },
    });

    await tx.timeEntry.updateMany({
      where: { id: { in: input.entry_ids } },
      data: { invoiceStatus: 'invoiced' },
    });

    return sync;
  });

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
