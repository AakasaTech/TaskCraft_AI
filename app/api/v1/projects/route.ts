import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError, getPageParams, paginationMeta } from '@/lib/api-response';
import { deliverWebhookEvent } from '@/lib/webhooks';

export const runtime = 'nodejs';

function serializeProject(p: {
  id: string; workspaceId: string; clientId: string | null; name: string; description: string | null;
  color: string; status: string; startDate: Date | null; dueDate: Date | null; budget: unknown;
  hourlyRate: unknown; billable: boolean; createdById: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id:           p.id,
    workspace_id: p.workspaceId,
    client_id:    p.clientId,
    name:         p.name,
    description:  p.description,
    color:        p.color,
    status:       p.status,
    start_date:   p.startDate ? p.startDate.toISOString() : null,
    due_date:     p.dueDate ? p.dueDate.toISOString() : null,
    budget:       p.budget,
    hourly_rate:  p.hourlyRate,
    billable:     p.billable,
    created_by:   p.createdById,
    created_at:   p.createdAt.toISOString(),
    updated_at:   p.updatedAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const url = new URL(req.url);
  const { page, perPage, offset } = getPageParams(url);
  const status = url.searchParams.get('status');

  const where = {
    workspaceId: ctx.workspaceId,
    ...(status ? { status } : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({ where, orderBy: { createdAt: 'desc' }, skip: offset, take: perPage }),
    prisma.project.count({ where }),
  ]);

  return apiSuccess(projects.map(serializeProject), paginationMeta({ total, page, perPage }));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return apiError('VALIDATION', 'name is required.', 422);

  try {
    const project = await prisma.project.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        name:        body.name.trim(),
        description: body.description?.trim() ?? null,
        status:      body.status ?? 'not_started',
        color:       body.color ?? undefined,
        startDate:   body.start_date ? new Date(body.start_date) : null,
        dueDate:     body.due_date ? new Date(body.due_date) : null,
        budget:      body.budget ?? null,
        hourlyRate:  body.hourly_rate ?? null,
      },
    });

    const data = serializeProject(project);
    deliverWebhookEvent({ workspaceId: ctx.workspaceId, event: 'project.created', data })
      .catch(console.error);

    return apiSuccess(data, null, 201);
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to create project.', 500);
  }
}
