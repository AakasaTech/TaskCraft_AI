import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { deliverWebhookEvent } from '@/lib/webhooks';

const VALID_STATUSES   = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type ValidStatus   = typeof VALID_STATUSES[number];
type ValidPriority = typeof VALID_PRIORITIES[number];
function isValidStatus(v: unknown): v is ValidStatus     { return VALID_STATUSES.includes(v as ValidStatus); }
function isValidPriority(v: unknown): v is ValidPriority { return VALID_PRIORITIES.includes(v as ValidPriority); }

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function serializeTask(t: {
  id: string; workspaceId: string; projectId: string | null; parentTaskId: string | null; title: string;
  description: string | null; assigneeId: string | null; createdById: string; status: string; priority: string;
  startDate: Date | null; dueDate: Date | null; completedAt: Date | null; estimatedHours: unknown;
  actualHours: unknown; billable: boolean; hourlyRate: unknown; createdAt: Date; updatedAt: Date;
}) {
  return {
    id:              t.id,
    workspace_id:    t.workspaceId,
    project_id:      t.projectId,
    parent_task_id:  t.parentTaskId,
    title:           t.title,
    description:     t.description,
    assignee_id:     t.assigneeId,
    created_by:      t.createdById,
    status:          t.status,
    priority:        t.priority,
    start_date:      t.startDate ? t.startDate.toISOString() : null,
    due_date:        t.dueDate ? t.dueDate.toISOString() : null,
    completed_at:    t.completedAt ? t.completedAt.toISOString() : null,
    estimated_hours: t.estimatedHours,
    actual_hours:    t.actualHours,
    billable:        t.billable,
    hourly_rate:     t.hourlyRate,
    created_at:      t.createdAt.toISOString(),
    updated_at:      t.updatedAt.toISOString(),
  };
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const task = await prisma.task.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!task) return apiError('NOT_FOUND', 'Task not found.', 404);

  return apiSuccess(serializeTask(task));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => ({}));

  if (body.status   !== undefined && !isValidStatus(body.status))
    return apiError('VALIDATION', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`, 422);
  if (body.priority !== undefined && !isValidPriority(body.priority))
    return apiError('VALIDATION', `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.`, 422);

  const existing = await prisma.task.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!existing) return apiError('NOT_FOUND', 'Task not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.title           !== undefined) patch.title          = body.title?.trim();
  if (body.description     !== undefined) patch.description    = body.description?.trim() ?? null;
  if (body.status          !== undefined) {
    patch.status = body.status;
    if (body.status === 'done') patch.completedAt = new Date();
    else if (existing.status === 'done') patch.completedAt = null;
  }
  if (body.priority        !== undefined) patch.priority        = body.priority;
  if (body.project_id      !== undefined) patch.projectId       = body.project_id ?? null;
  if (body.assignee_id     !== undefined) patch.assigneeId      = body.assignee_id ?? null;
  if (body.due_date        !== undefined) patch.dueDate         = body.due_date ? new Date(body.due_date) : null;
  if (body.start_date      !== undefined) patch.startDate       = body.start_date ? new Date(body.start_date) : null;
  if (body.estimated_hours !== undefined) patch.estimatedHours  = body.estimated_hours ?? null;
  if (body.billable        !== undefined) patch.billable        = body.billable;
  if (body.hourly_rate     !== undefined) patch.hourlyRate      = body.hourly_rate ?? null;

  try {
    const task = await prisma.task.update({ where: { id }, data: patch });
    const data = serializeTask(task);

    const event = body.status === 'done' ? 'task.completed' : 'task.updated';
    deliverWebhookEvent({ workspaceId: ctx.workspaceId, event, data })
      .catch(console.error);

    return apiSuccess(data);
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to update task.', 500);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const task = await prisma.task.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!task) return apiError('NOT_FOUND', 'Task not found.', 404);

  await prisma.task.delete({ where: { id } });
  return apiSuccess({ id, deleted: true });
}
