import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError, getPageParams, paginationMeta } from '@/lib/api-response';

export const runtime = 'nodejs';

async function checkSoloPlan(workspaceId: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();
  return ['solo', 'team'].includes(data?.plan ?? '');
}

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);
  if (!await checkSoloPlan(ctx.workspaceId, ctx.userId)) {
    return apiError('PLAN_REQUIRED', 'Clients API requires a Solo or Team plan.', 403);
  }

  const url    = new URL(req.url);
  const { page, perPage, offset } = getPageParams(url);

  const admin = createAdminClient();
  const { data, count, error } = await admin
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('workspace_id', ctx.workspaceId)
    .order('name', { ascending: true })
    .range(offset, offset + perPage - 1);

  if (error) return apiError('INTERNAL', error.message, 500);
  return apiSuccess(data, paginationMeta({ total: count ?? 0, page, perPage }));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);
  if (!await checkSoloPlan(ctx.workspaceId, ctx.userId)) {
    return apiError('PLAN_REQUIRED', 'Clients API requires a Solo or Team plan.', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return apiError('VALIDATION', 'name is required.', 422);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('clients')
    .insert({
      workspace_id:        ctx.workspaceId,
      created_by:          ctx.userId,
      name:                body.name.trim(),
      email:               body.email       ?? null,
      company:             body.company     ?? null,
      phone:               body.phone       ?? null,
      website:             body.website     ?? null,
      currency:            body.currency    ?? 'USD',
      notes:               body.notes       ?? null,
      default_hourly_rate: body.default_hourly_rate ?? null,
    })
    .select()
    .single();

  if (error) return apiError('INTERNAL', error.message, 500);
  return apiSuccess(data, null, 201);
}
