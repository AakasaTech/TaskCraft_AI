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
  const projectId     = url.searchParams.get('project_id');
  const userId        = url.searchParams.get('user_id');
  const billable      = url.searchParams.get('billable');
  const invoiceStatus = url.searchParams.get('invoice_status');
  const dateFrom      = url.searchParams.get('date_from');
  const dateTo        = url.searchParams.get('date_to');

  const admin = createAdminClient();
  let query = admin
    .from('time_entries')
    .select('*', { count: 'exact' })
    .eq('workspace_id', ctx.workspaceId)
    .order('started_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (projectId)     query = query.eq('project_id', projectId);
  if (userId)        query = query.eq('user_id', userId);
  if (billable)      query = query.eq('billable', billable === 'true');
  if (invoiceStatus) query = query.eq('invoice_status', invoiceStatus);
  if (dateFrom)      query = query.gte('started_at', dateFrom);
  if (dateTo)        query = query.lte('started_at', dateTo);

  const { data, count, error } = await query;
  if (error) return apiError('INTERNAL', error.message, 500);

  return apiSuccess(data, paginationMeta({ total: count ?? 0, page, perPage }));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => null);
  if (!body) return apiError('VALIDATION', 'Request body is required.', 422);
  if (!body.duration_minutes && !body.started_at) {
    return apiError('VALIDATION', 'Either duration_minutes or started_at is required.', 422);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('time_entries')
    .insert({
      workspace_id:     ctx.workspaceId,
      user_id:          body.user_id ?? ctx.userId,
      project_id:       body.project_id   ?? null,
      task_id:          body.task_id       ?? null,
      description:      body.description?.trim() ?? null,
      started_at:       body.started_at   ?? new Date().toISOString(),
      ended_at:         body.ended_at     ?? null,
      duration_minutes: body.duration_minutes ?? null,
      billable:         body.billable ?? false,
      hourly_rate:      body.hourly_rate ?? null,
      source:           body.source ?? 'manual',
    })
    .select()
    .single();

  if (error) return apiError('INTERNAL', error.message, 500);

  deliverWebhookEvent({ workspaceId: ctx.workspaceId, event: 'time_entry.created', data: data as Record<string, unknown> })
    .catch(console.error);

  return apiSuccess(data, null, 201);
}
