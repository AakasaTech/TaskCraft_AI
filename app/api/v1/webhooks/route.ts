import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import type { WebhookEventType } from '@/lib/types';

export const runtime = 'nodejs';

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

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const webhooks = await prisma.webhook.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, url: true, events: true, active: true, lastFiredAt: true, createdAt: true },
  });

  return apiSuccess(webhooks.map(serializeWebhook));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'admin')) return apiError('FORBIDDEN', 'Admin scope required to create webhooks.', 403);

  const body = await req.json().catch(() => null);
  if (!body?.url)            return apiError('VALIDATION', 'url is required.', 422);
  if (!body?.events?.length) return apiError('VALIDATION', 'events array is required.', 422);

  const invalid = (body.events as string[]).filter((e) => !VALID_EVENTS.includes(e));
  if (invalid.length) {
    return apiError('VALIDATION', `Unknown event types: ${invalid.join(', ')}`, 422);
  }

  try { new URL(body.url); } catch {
    return apiError('VALIDATION', 'url must be a valid URL.', 422);
  }

  const secret = randomBytes(24).toString('hex');

  try {
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId:      ctx.userId,
        name:        body.name?.trim() || body.url,
        url:         body.url,
        secret,
        events:      body.events as WebhookEventType[],
        active:      body.active ?? true,
      },
      select: { id: true, name: true, url: true, events: true, active: true, lastFiredAt: true, createdAt: true },
    });

    return apiSuccess({ ...serializeWebhook(webhook), secret }, null, 201);
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to create webhook.', 500);
  }
}
