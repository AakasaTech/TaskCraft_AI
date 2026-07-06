import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError, getPageParams, paginationMeta } from '@/lib/api-response';
import { deliverWebhookEvent } from '@/lib/webhooks';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const url    = new URL(req.url);
  const { page, perPage, offset } = getPageParams(url);
  const status = url.searchParams.get('status');

  const admin = createAdminClient();
  let query = admin
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) return apiError('INTERNAL', error.message, 500);

  return apiSuccess(data, paginationMeta({ total: count ?? 0, page, perPage }));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return apiError('VALIDATION', 'name is required.', 422);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('projects')
    .insert({
      workspace_id: ctx.workspaceId,
      created_by:   ctx.userId,
      name:         body.name.trim(),
      description:  body.description?.trim() ?? null,
      status:       body.status ?? 'not_started',
      color:        body.color ?? null,
      start_date:   body.start_date ?? null,
      due_date:     body.due_date ?? null,
      budget_hours: body.budget_hours ?? null,
    })
    .select()
    .single();

  if (error) return apiError('INTERNAL', error.message, 500);

  deliverWebhookEvent({ workspaceId: ctx.workspaceId, event: 'project.created', data: data as Record<string, unknown> })
    .catch(console.error);

  return apiSuccess(data, null, 201);
}
