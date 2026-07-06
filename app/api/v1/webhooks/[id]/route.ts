import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const VALID_EVENTS = [
  'task.created', 'task.updated', 'task.completed',
  'project.created', 'project.completed',
  'time_entry.created', 'invoice.created', 'support_ticket.linked',
];

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const admin = createAdminClient();
  const { data } = await admin
    .from('webhooks')
    .select('id, name, url, events, active, last_fired_at, created_at')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!data) return apiError('NOT_FOUND', 'Webhook not found.', 404);

  // Include delivery history
  const { data: deliveries } = await admin
    .from('webhook_deliveries')
    .select('id, event, status_code, error, delivered_at, attempts, created_at')
    .eq('webhook_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  return apiSuccess({ ...data, recent_deliveries: deliveries ?? [] });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'admin')) return apiError('FORBIDDEN', 'Admin scope required.', 403);

  const body  = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('webhooks')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!existing) return apiError('NOT_FOUND', 'Webhook not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.name   !== undefined) patch.name   = body.name?.trim() || null;
  if (body.url    !== undefined) {
    try { new URL(body.url); } catch { return apiError('VALIDATION', 'url must be a valid URL.', 422); }
    patch.url = body.url;
  }
  if (body.active !== undefined) patch.active = body.active;
  if (body.events !== undefined) {
    const invalid = (body.events as string[]).filter((e) => !VALID_EVENTS.includes(e));
    if (invalid.length) return apiError('VALIDATION', `Unknown event types: ${invalid.join(', ')}`, 422);
    patch.events = body.events;
  }

  const { data, error } = await admin
    .from('webhooks')
    .update(patch)
    .eq('id', id)
    .select('id, name, url, events, active, last_fired_at, created_at')
    .single();

  if (error) return apiError('INTERNAL', error.message, 500);
  return apiSuccess(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'admin')) return apiError('FORBIDDEN', 'Admin scope required.', 403);

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('webhooks')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (!existing) return apiError('NOT_FOUND', 'Webhook not found.', 404);

  const { error } = await admin.from('webhooks').delete().eq('id', id);
  if (error) return apiError('INTERNAL', error.message, 500);
  return apiSuccess({ id, deleted: true });
}
