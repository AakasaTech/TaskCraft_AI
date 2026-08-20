import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError, getPageParams, paginationMeta } from '@/lib/api-response';
import { deliverWebhookEvent } from '@/lib/webhooks';

export const runtime = 'nodejs';

const VALID_STATUSES   = ['backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

type Status   = typeof VALID_STATUSES[number];
type Priority = typeof VALID_PRIORITIES[number];

function isValidStatus(v: unknown): v is Status     { return VALID_STATUSES.includes(v as Status); }
function isValidPriority(v: unknown): v is Priority { return VALID_PRIORITIES.includes(v as Priority); }

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

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const url         = new URL(req.url);
  const { page, perPage, offset } = getPageParams(url);
  const projectId   = url.searchParams.get('project_id');
  const status      = url.searchParams.get('status');
  const priority    = url.searchParams.get('priority');
  const assigneeId  = url.searchParams.get('assignee_id');

  if (status && !isValidStatus(status))
    return apiError('VALIDATION', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`, 422);
  if (priority && !isValidPriority(priority))
    return apiError('VALIDATION', `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.`, 422);

  const where = {
    workspaceId:  ctx.workspaceId,
    parentTaskId: null,
    ...(projectId  ? { projectId }              : {}),
    ...(status     ? { status }                 : {}),
    ...(priority   ? { priority }                : {}),
    ...(assigneeId ? { assigneeId }              : {}),
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: perPage }),
    prisma.task.count({ where }),
  ]);

  return apiSuccess(tasks.map(serializeTask), paginationMeta({ total, page, perPage }));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => null);
  if (!body?.title?.trim()) return apiError('VALIDATION', 'title is required.', 422);

  if (body.status && !isValidStatus(body.status))
    return apiError('VALIDATION', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`, 422);
  if (body.priority && !isValidPriority(body.priority))
    return apiError('VALIDATION', `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.`, 422);

  try {
    const task = await prisma.task.create({
      data: {
        workspaceId:    ctx.workspaceId,
        createdById:    ctx.userId,
        title:          body.title.trim(),
        description:    body.description?.trim() ?? null,
        status:         (body.status as Status)     ?? 'todo',
        priority:       (body.priority as Priority) ?? 'medium',
        projectId:      body.project_id  ?? null,
        assigneeId:     body.assignee_id ?? null,
        dueDate:        body.due_date    ? new Date(body.due_date)   : null,
        startDate:      body.start_date  ? new Date(body.start_date) : null,
        estimatedHours: body.estimated_hours ?? null,
        billable:       body.billable ?? false,
        hourlyRate:     body.hourly_rate ?? null,
      },
    });

    const data = serializeTask(task);
    deliverWebhookEvent({ workspaceId: ctx.workspaceId, event: 'task.created', data })
      .catch(console.error);

    return apiSuccess(data, null, 201);
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to create task.', 500);
  }
}
