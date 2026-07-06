import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { deliverWebhookEvent } from '@/lib/webhooks';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

async function resolveProject(admin: ReturnType<typeof createAdminClient>, id: string, workspaceId: string) {
  const { data } = await admin
    .from('projects')
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

  const project = await resolveProject(createAdminClient(), id, ctx.workspaceId);
  if (!project) return apiError('NOT_FOUND', 'Project not found.', 404);

  return apiSuccess(project);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body  = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  const project = await resolveProject(admin, id, ctx.workspaceId);
  if (!project) return apiError('NOT_FOUND', 'Project not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.name        !== undefined) patch.name        = body.name?.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() ?? null;
  if (body.status      !== undefined) patch.status      = body.status;
  if (body.color       !== undefined) patch.color       = body.color;
  if (body.due_date    !== undefined) patch.due_date    = body.due_date ?? null;
  if (body.start_date  !== undefined) patch.start_date  = body.start_date ?? null;
  if (body.budget_hours !== undefined) patch.budget_hours = body.budget_hours ?? null;

  const { data, error } = await admin
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return apiError('INTERNAL', error.message, 500);

  if (body.status === 'completed') {
    deliverWebhookEvent({ workspaceId: ctx.workspaceId, event: 'project.completed', data: data as Record<string, unknown> })
      .catch(console.error);
  }

  return apiSuccess(data);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const admin   = createAdminClient();
  const project = await resolveProject(admin, id, ctx.workspaceId);
  if (!project) return apiError('NOT_FOUND', 'Project not found.', 404);

  const { error } = await admin.from('projects').delete().eq('id', id);
  if (error) return apiError('INTERNAL', error.message, 500);

  return apiSuccess({ id, deleted: true });
}
