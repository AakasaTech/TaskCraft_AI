import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError, getPageParams, paginationMeta } from '@/lib/api-response';

export const runtime = 'nodejs';

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

async function checkSoloPlan(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { plan: true } });
  return ['solo', 'team'].includes(profile?.plan ?? '');
}

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);
  if (!await checkSoloPlan(ctx.userId)) {
    return apiError('PLAN_REQUIRED', 'Clients API requires a Solo or Team plan.', 403);
  }

  const url = new URL(req.url);
  const { page, perPage, offset } = getPageParams(url);

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: 'asc' },
      skip: offset,
      take: perPage,
    }),
    prisma.client.count({ where: { workspaceId: ctx.workspaceId } }),
  ]);

  return apiSuccess(clients.map(serializeClient), paginationMeta({ total, page, perPage }));
}

export async function POST(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'write')) return apiError('FORBIDDEN', 'Write scope required.', 403);
  if (!await checkSoloPlan(ctx.userId)) {
    return apiError('PLAN_REQUIRED', 'Clients API requires a Solo or Team plan.', 403);
  }

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return apiError('VALIDATION', 'name is required.', 422);

  try {
    const client = await prisma.client.create({
      data: {
        workspaceId: ctx.workspaceId,
        createdById: ctx.userId,
        name:        body.name.trim(),
        email:       body.email   ?? null,
        company:     body.company ?? null,
        phone:       body.phone   ?? null,
        website:     body.website ?? null,
        notes:       body.notes   ?? null,
        address:     body.address ?? {},
      },
    });
    return apiSuccess(serializeClient(client), null, 201);
  } catch (err) {
    return apiError('INTERNAL', err instanceof Error ? err.message : 'Failed to create client.', 500);
  }
}
