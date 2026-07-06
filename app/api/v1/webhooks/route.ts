import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const runtime = 'nodejs';

const VALID_EVENTS = [
  'task.created', 'task.updated', 'task.completed',
  'project.created', 'project.completed',
  'time_entry.created', 'invoice.created', 'support_ticket.linked',
];

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const { data, error } = await createAdminClient()
    .from('webhooks')
    .select('id, name, url, events, active, last_fired_at, created_at')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false });

  if (error) return apiError('INTERNAL', error.message, 500);
  return apiSuccess(data);
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'admin')) return apiError('FORBIDDEN', 'Admin scope required to create webhooks.', 403);

  const body = await req.json().catch(() => null);
  if (!body?.url)     return apiError('VALIDATION', 'url is required.', 422);
  if (!body?.events?.length) return apiError('VALIDATION', 'events array is required.', 422);

  const invalid = (body.events as string[]).filter((e) => !VALID_EVENTS.includes(e));
  if (invalid.length) {
    return apiError('VALIDATION', `Unknown event types: ${invalid.join(', ')}`, 422);
  }

  try { new URL(body.url); } catch {
    return apiError('VALIDATION', 'url must be a valid URL.', 422);
  }

  const secret = randomBytes(24).toString('hex');

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('webhooks')
    .insert({
      workspace_id: ctx.workspaceId,
      user_id:      ctx.userId,
      name:         body.name?.trim() || body.url,
      url:          body.url,
      secret,
      events:       body.events,
      active:       body.active ?? true,
    })
    .select('id, name, url, events, active, last_fired_at, created_at')
    .single();

  if (error) return apiError('INTERNAL', error.message, 500);

  // Return secret only on creation
  return apiSuccess({ ...data, secret }, null, 201);
}
