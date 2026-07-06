import { createAdminClient } from '@/lib/supabase/admin';
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

async function resolveTask(admin: ReturnType<typeof createAdminClient>, id: string, workspaceId: string) {
  const { data } = await admin
    .from('tasks')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data;
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const task = await resolveTask(createAdminClient(), id, ctx.workspaceId);
  if (!task) return apiError('NOT_FOUND', 'Task not found.', 404);

  return apiSuccess(task);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body  = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  // Validate enum fields before hitting the DB
  if (body.status   !== undefined && !isValidStatus(body.status))
    return apiError('VALIDATION', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`, 422);
  if (body.priority !== undefined && !isValidPriority(body.priority))
    return apiError('VALIDATION', `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.`, 422);

  const existing = await resolveTask(admin, id, ctx.workspaceId);
  if (!existing) return apiError('NOT_FOUND', 'Task not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.title           !== undefined) patch.title           = body.title?.trim();
  if (body.description     !== undefined) patch.description     = body.description?.trim() ?? null;
  if (body.status          !== undefined) {
    patch.status = body.status;
    if (body.status === 'done') patch.completed_at = new Date().toISOString();
    else if (existing.status === 'done') patch.completed_at = null;
  }
  if (body.priority        !== undefined) patch.priority        = body.priority;
  if (body.project_id      !== undefined) patch.project_id      = body.project_id ?? null;
  if (body.assignee_id     !== undefined) patch.assignee_id     = body.assignee_id ?? null;
  if (body.due_date        !== undefined) patch.due_date        = body.due_date ?? null;
  if (body.start_date      !== undefined) patch.start_date      = body.start_date ?? null;
  if (body.estimated_hours !== undefined) patch.estimated_hours = body.estimated_hours ?? null;
  if (body.billable        !== undefined) patch.billable        = body.billable;
  if (body.hourly_rate     !== undefined) patch.hourly_rate     = body.hourly_rate ?? null;

  const { data, error } = await admin.from('tasks').update(patch).eq('id', id).select().single();
  if (error) return apiError('INTERNAL', error.message, 500);

  // Fire appropriate webhook
  const event = body.status === 'done' ? 'task.completed' : 'task.updated';
  deliverWebhookEvent({ workspaceId: ctx.workspaceId, event, data: data as Record<string, unknown> })
    .catch(console.error);

  return apiSuccess(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const admin = createAdminClient();
  const task  = await resolveTask(admin, id, ctx.workspaceId);
  if (!task) return apiError('NOT_FOUND', 'Task not found.', 404);

  const { error } = await admin.from('tasks').delete().eq('id', id);
  if (error) return apiError('INTERNAL', error.message, 500);

  return apiSuccess({ id, deleted: true });
}
