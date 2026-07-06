import { createAdminClient } from '@/lib/supabase/admin';
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

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const url    = new URL(req.url);
  const { page, perPage, offset } = getPageParams(url);
  const projectId  = url.searchParams.get('project_id');
  const status     = url.searchParams.get('status');
  const priority   = url.searchParams.get('priority');
  const assigneeId = url.searchParams.get('assignee_id');

  // Validate enum filters
  if (status && !isValidStatus(status))
    return apiError('VALIDATION', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`, 422);
  if (priority && !isValidPriority(priority))
    return apiError('VALIDATION', `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.`, 422);

  const admin = createAdminClient();
  let query = admin
    .from('tasks')
    .select('*', { count: 'exact' })
    .eq('workspace_id', ctx.workspaceId)
    .is('parent_task_id', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (projectId)  query = query.eq('project_id', projectId);
  if (status)     query = query.eq('status', status);
  if (priority)   query = query.eq('priority', priority);
  if (assigneeId) query = query.eq('assignee_id', assigneeId);

  const { data, count, error } = await query;
  if (error) return apiError('INTERNAL', error.message, 500);

  return apiSuccess(data, paginationMeta({ total: count ?? 0, page, perPage }));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => null);
  if (!body?.title?.trim()) return apiError('VALIDATION', 'title is required.', 422);

  // Validate enum values
  if (body.status && !isValidStatus(body.status))
    return apiError('VALIDATION', `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}.`, 422);
  if (body.priority && !isValidPriority(body.priority))
    return apiError('VALIDATION', `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}.`, 422);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tasks')
    .insert({
      workspace_id:    ctx.workspaceId,
      created_by:      ctx.userId,
      title:           body.title.trim(),
      description:     body.description?.trim() ?? null,
      status:          (body.status    as Status)   ?? 'todo',
      priority:        (body.priority  as Priority) ?? 'medium',
      project_id:      body.project_id    ?? null,
      assignee_id:     body.assignee_id   ?? null,
      due_date:        body.due_date      ?? null,
      start_date:      body.start_date    ?? null,
      estimated_hours: body.estimated_hours ?? null,
      billable:        body.billable ?? false,
      hourly_rate:     body.hourly_rate   ?? null,
    })
    .select()
    .single();

  if (error) return apiError('INTERNAL', error.message, 500);

  deliverWebhookEvent({ workspaceId: ctx.workspaceId, event: 'task.created', data: data as Record<string, unknown> })
    .catch(console.error);

  return apiSuccess(data, null, 201);
}
