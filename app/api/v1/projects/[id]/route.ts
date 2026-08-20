import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { deliverWebhookEvent } from '@/lib/webhooks';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const project = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!project) return apiError('NOT_FOUND', 'Project not found.', 404);

  return apiSuccess(serializeProject(project));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => ({}));

  const existing = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!existing) return apiError('NOT_FOUND', 'Project not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.name        !== undefined) patch.name        = body.name?.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() ?? null;
  if (body.status      !== undefined) patch.status      = body.status;
  if (body.color       !== undefined) patch.color       = body.color;
  if (body.due_date    !== undefined) patch.dueDate     = body.due_date ? new Date(body.due_date) : null;
  if (body.start_date  !== undefined) patch.startDate   = body.start_date ? new Date(body.start_date) : null;
  if (body.budget      !== undefined) patch.budget      = body.budget ?? null;
  if (body.hourly_rate !== undefined) patch.hourlyRate  = body.hourly_rate ?? null;

  try {
    const project = await prisma.project.update({ where: { id }, data: patch });
    const data = serializeProject(project);

    if (body.status === 'completed') {
      deliverWebhookEvent({ workspaceId: ctx.workspaceId, event: 'project.completed', data })
        .catch(console.error);
    }

    return apiSuccess(data);
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to update project.', 500);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const existing = await prisma.project.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!existing) return apiError('NOT_FOUND', 'Project not found.', 404);

  await prisma.project.delete({ where: { id } });
  return apiSuccess({ id, deleted: true });
}
