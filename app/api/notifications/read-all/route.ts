import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth/helpers';

export const runtime = 'nodejs';

export async function POST() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  });

  return Response.json({ ok: true });
}
