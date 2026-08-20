import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

function serializeClient(c: {
  id: string; workspaceId: string; name: string; email: string | null; phone: string | null;
  company: string | null; website: string | null; address: unknown; notes: string | null;
  createdById: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id:           c.id,
    workspace_id: c.workspaceId,
    name:         c.name,
    email:        c.email,
    phone:        c.phone,
    company:      c.company,
    website:      c.website,
    address:      c.address,
    notes:        c.notes,
    created_by:   c.createdById,
    created_at:   c.createdAt.toISOString(),
    updated_at:   c.updatedAt.toISOString(),
  };
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const client = await prisma.client.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!client) return apiError('NOT_FOUND', 'Client not found.', 404);
  return apiSuccess(serializeClient(client));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const body = await req.json().catch(() => ({}));

  const existing = await prisma.client.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!existing) return apiError('NOT_FOUND', 'Client not found.', 404);

  const patch: Record<string, unknown> = {};
  if (body.name    !== undefined) patch.name    = body.name?.trim();
  if (body.email   !== undefined) patch.email   = body.email ?? null;
  if (body.company !== undefined) patch.company = body.company ?? null;
  if (body.phone   !== undefined) patch.phone   = body.phone ?? null;
  if (body.website !== undefined) patch.website = body.website ?? null;
  if (body.notes   !== undefined) patch.notes   = body.notes ?? null;
  if (body.address !== undefined) patch.address = body.address ?? {};

  try {
    const client = await prisma.client.update({ where: { id }, data: patch });
    return apiSuccess(serializeClient(client));
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to update client.', 500);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);

  const existing = await prisma.client.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!existing) return apiError('NOT_FOUND', 'Client not found.', 404);

  await prisma.client.delete({ where: { id } });
  return apiSuccess({ id, deleted: true });
}
