import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth/helpers';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100);
  const before = searchParams.get('before'); // cursor: created_at of last item

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);

  return Response.json({
    notifications: notifications.map((n) => ({
      id:           n.id,
      user_id:      n.userId,
      workspace_id: n.workspaceId,
      type:         n.type,
      title:        n.title,
      body:         n.body,
      link:         n.link,
      is_read:      n.isRead,
      read_at:      n.readAt ? n.readAt.toISOString() : null,
      metadata:     n.metadata,
      created_at:   n.createdAt.toISOString(),
    })),
    unread_count: unreadCount,
    has_more:     notifications.length === limit,
  });
}
