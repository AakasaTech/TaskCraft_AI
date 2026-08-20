import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const entry = await prisma.timeEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!entry) return apiError('NOT_FOUND', 'Time entry not found.', 404);
  return apiSuccess(serializeTimeEntry(entry));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => ({}));

  const existing = await prisma.timeEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) return apiError('NOT_FOUND', 'Time entry not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.description      !== undefined) patch.description     = body.description?.trim() ?? null;
  if (body.start_time       !== undefined) patch.startTime        = new Date(body.start_time);
  if (body.end_time         !== undefined) patch.endTime          = body.end_time ? new Date(body.end_time) : null;
  if (body.billable         !== undefined) patch.billable         = body.billable;
  if (body.hourly_rate      !== undefined) patch.hourlyRate       = body.hourly_rate ?? null;
  if (body.invoice_status   !== undefined) patch.invoiceStatus    = body.invoice_status;
  if (body.project_id       !== undefined) patch.projectId        = body.project_id ?? null;
  if (body.task_id          !== undefined) patch.taskId           = body.task_id ?? null;

  if (body.duration_minutes !== undefined) {
    patch.durationMinutes = body.duration_minutes ?? null;
  } else if (body.start_time !== undefined || body.end_time !== undefined) {
    const start = body.start_time !== undefined ? new Date(body.start_time) : existing.startTime;
    const end   = body.end_time   !== undefined ? (body.end_time ? new Date(body.end_time) : null) : existing.endTime;
    if (start && end) {
      patch.durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    }
  }

  try {
    const entry = await prisma.timeEntry.update({ where: { id }, data: patch });
    return apiSuccess(serializeTimeEntry(entry));
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to update time entry.', 500);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const existing = await prisma.timeEntry.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!existing) return apiError('NOT_FOUND', 'Time entry not found.', 404);

  await prisma.timeEntry.delete({ where: { id } });
  return apiSuccess({ id, deleted: true });
}
