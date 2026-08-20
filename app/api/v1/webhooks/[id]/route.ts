import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const VALID_EVENTS = [
  'task.created', 'task.updated', 'task.completed',
  'project.created', 'project.completed',
  'time_entry.created', 'invoice.created', 'support_ticket.linked',
];

function serializeWebhook(w: {
  id: string; name: string; url: string; events: string[]; active: boolean;
  lastFiredAt: Date | null; createdAt: Date;
}) {
  return {
    id:            w.id,
    name:          w.name,
    url:           w.url,
    events:        w.events,
    active:        w.active,
    last_fired_at: w.lastFiredAt ? w.lastFiredAt.toISOString() : null,
    created_at:    w.createdAt.toISOString(),
  };
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const webhook = await prisma.webhook.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, name: true, url: true, events: true, active: true, lastFiredAt: true, createdAt: true },
  });
  if (!webhook) return apiError('NOT_FOUND', 'Webhook not found.', 404);

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, event: true, statusCode: true, error: true, deliveredAt: true, attempts: true, createdAt: true },
  });

  return apiSuccess({
    ...serializeWebhook(webhook),
    recent_deliveries: deliveries.map((d) => ({
      id:           d.id,
      event:        d.event,
      status_code:  d.statusCode,
      error:        d.error,
      delivered_at: d.deliveredAt ? d.deliveredAt.toISOString() : null,
      attempts:     d.attempts,
      created_at:   d.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'admin')) return apiError('FORBIDDEN', 'Admin scope required.', 403);

  const body = await req.json().catch(() => ({}));

  const existing = await prisma.webhook.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!existing) return apiError('NOT_FOUND', 'Webhook not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.name   !== undefined) patch.name = body.name?.trim() || null;
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

  try {
    const webhook = await prisma.webhook.update({
      where: { id },
      data:  patch,
      select: { id: true, name: true, url: true, events: true, active: true, lastFiredAt: true, createdAt: true },
    });
    return apiSuccess(serializeWebhook(webhook));
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to update webhook.', 500);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'admin')) return apiError('FORBIDDEN', 'Admin scope required.', 403);

  const existing = await prisma.webhook.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!existing) return apiError('NOT_FOUND', 'Webhook not found.', 404);

  await prisma.webhook.delete({ where: { id } });
  return apiSuccess({ id, deleted: true });
}
