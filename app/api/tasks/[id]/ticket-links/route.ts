import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth/helpers';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const links = await prisma.supportTicketLink.findMany({ where: { taskId: id } });

  return Response.json({
    data: links.map((l) => ({
      id:                      l.id,
      workspace_id:            l.workspaceId,
      task_id:                 l.taskId,
      supportcraft_ticket_id:  l.supportcraftTicketId,
      ticket_title:            l.ticketTitle,
      ticket_url:              l.ticketUrl,
      sync_status:             l.syncStatus,
      created_by:              l.createdById,
      created_at:              l.createdAt.toISOString(),
      updated_at:              l.updatedAt.toISOString(),
    })),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;
  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get('link_id');
  if (!linkId) return Response.json({ error: 'Missing link_id' }, { status: 400 });

  const user = await getAuthUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.supportTicketLink.deleteMany({ where: { id: linkId, taskId } });

  return Response.json({ ok: true });
}
