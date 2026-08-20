import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError, getPageParams, paginationMeta } from '@/lib/api-response';
import { deliverWebhookEvent } from '@/lib/webhooks';

export const runtime = 'nodejs';

function serializeTimeEntry(e: {
  id: string; workspaceId: string; taskId: string | null; projectId: string | null; userId: string;
  description: string | null; startTime: Date; endTime: Date | null; durationMinutes: number | null;
  billable: boolean; hourlyRate: unknown; invoiceStatus: string; source: string; createdAt: Date; updatedAt: Date;
}) {
  return {
    id:                e.id,
    workspace_id:      e.workspaceId,
    task_id:           e.taskId,
    project_id:        e.projectId,
    user_id:           e.userId,
    description:       e.description,
    start_time:        e.startTime.toISOString(),
    end_time:          e.endTime ? e.endTime.toISOString() : null,
    duration_minutes:  e.durationMinutes,
    billable:          e.billable,
    hourly_rate:       e.hourlyRate,
    invoice_status:    e.invoiceStatus,
    source:            e.source,
    created_at:        e.createdAt.toISOString(),
    updated_at:        e.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const url            = new URL(req.url);
  const { page, perPage, offset } = getPageParams(url);
  const projectId      = url.searchParams.get('project_id');
  const userId         = url.searchParams.get('user_id');
  const billable       = url.searchParams.get('billable');
  const invoiceStatus  = url.searchParams.get('invoice_status');
  const dateFrom       = url.searchParams.get('date_from');
  const dateTo         = url.searchParams.get('date_to');

  const where = {
    workspaceId: ctx.workspaceId,
    ...(projectId      ? { projectId }                          : {}),
    ...(userId         ? { userId }                              : {}),
    ...(billable        ? { billable: billable === 'true' }      : {}),
    ...(invoiceStatus  ? { invoiceStatus }                       : {}),
    ...(dateFrom || dateTo ? { startTime: {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
    } } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({ where, orderBy: { startTime: 'desc' }, skip: offset, take: perPage }),
    prisma.timeEntry.count({ where }),
  ]);

  return apiSuccess(entries.map(serializeTimeEntry), paginationMeta({ total, page, perPage }));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('VALIDATION', 'Request body is required.', 422);
  if (!body.duration_minutes && !body.start_time) {
    return apiError('VALIDATION', 'Either duration_minutes or start_time is required.', 422);
  }

  const startTime = body.start_time ? new Date(body.start_time) : new Date();
  const endTime   = body.end_time ? new Date(body.end_time) : null;
  const durationMinutes = body.duration_minutes ??
    (endTime ? Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000)) : null);

  try {
    const entry = await prisma.timeEntry.create({
      data: {
        workspaceId:     ctx.workspaceId,
        userId:          body.user_id ?? ctx.userId,
        projectId:       body.project_id ?? null,
        taskId:          body.task_id ?? null,
        description:     body.description?.trim() ?? null,
        startTime,
        endTime,
        durationMinutes,
        billable:        body.billable ?? false,
        hourlyRate:      body.hourly_rate ?? null,
        source:          body.source ?? 'manual',
      },
    });

    const data = serializeTimeEntry(entry);
    deliverWebhookEvent({ workspaceId: ctx.workspaceId, event: 'time_entry.created', data })
      .catch(console.error);

    return apiSuccess(data, null, 201);
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to create time entry.', 500);
  }
}
