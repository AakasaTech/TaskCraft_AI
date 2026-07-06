import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const { data } = await createAdminClient()
    .from('time_entries')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!data) return apiError('NOT_FOUND', 'Time entry not found.', 404);
  return apiSuccess(data);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body  = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('time_entries')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!existing) return apiError('NOT_FOUND', 'Time entry not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.description      !== undefined) patch.description      = body.description?.trim() ?? null;
  if (body.started_at       !== undefined) patch.started_at       = body.started_at;
  if (body.ended_at         !== undefined) patch.ended_at         = body.ended_at ?? null;
  if (body.duration_minutes !== undefined) patch.duration_minutes = body.duration_minutes ?? null;
  if (body.billable         !== undefined) patch.billable         = body.billable;
  if (body.hourly_rate      !== undefined) patch.hourly_rate      = body.hourly_rate ?? null;
  if (body.invoice_status   !== undefined) patch.invoice_status   = body.invoice_status;
  if (body.project_id       !== undefined) patch.project_id       = body.project_id ?? null;
  if (body.task_id          !== undefined) patch.task_id          = body.task_id ?? null;

  const { data, error } = await admin
    .from('time_entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return apiError('INTERNAL', error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('time_entries')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!existing) return apiError('NOT_FOUND', 'Time entry not found.', 404);

  const { error } = await admin.from('time_entries').delete().eq('id', id);
  if (error) return apiError('INTERNAL', error.message, 500);

  return apiSuccess({ id, deleted: true });
}
