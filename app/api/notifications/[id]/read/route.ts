import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth/helpers';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data:  { isRead: true, readAt: new Date() },
  });

  return Response.json({ ok: true });
}
