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
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!data) return apiError('NOT_FOUND', 'Client not found.', 404);
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
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!existing) return apiError('NOT_FOUND', 'Client not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.name                !== undefined) patch.name                = body.name?.trim();
  if (body.email               !== undefined) patch.email               = body.email ?? null;
  if (body.company             !== undefined) patch.company             = body.company ?? null;
  if (body.phone               !== undefined) patch.phone               = body.phone ?? null;
  if (body.website             !== undefined) patch.website             = body.website ?? null;
  if (body.currency            !== undefined) patch.currency            = body.currency;
  if (body.notes               !== undefined) patch.notes               = body.notes ?? null;
  if (body.default_hourly_rate !== undefined) patch.default_hourly_rate = body.default_hourly_rate ?? null;

  const { data, error } = await admin.from('clients').update(patch).eq('id', id).select().single();
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
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!existing) return apiError('NOT_FOUND', 'Client not found.', 404);

  const { error } = await admin.from('clients').delete().eq('id', id);
  if (error) return apiError('INTERNAL', error.message, 500);
  return apiSuccess({ id, deleted: true });
}
