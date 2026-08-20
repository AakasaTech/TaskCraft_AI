import { prisma } from '@/lib/prisma';
import { runDueNotifications } from '@/lib/notifications';

export const runtime = 'nodejs';

/**
 * POST /api/notifications/trigger/due-check
 * Intended to be called by a Vercel Cron job on a schedule.
 * Requires the CRON_SECRET header for authorization.
 *
 * Vercel cron.json example:
 * { "crons": [{ "path": "/api/notifications/trigger/due-check", "schedule": "0 * * * *" }] }
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspaces = await prisma.workspace.findMany({ select: { id: true } });

  let totalDueSoon = 0;
  let totalOverdue = 0;

  for (const ws of workspaces) {
    const result = await runDueNotifications(ws.id);
    totalDueSoon += result.dueSoonCount;
    totalOverdue += result.overdueCount;
  }

  return Response.json({
    ok: true,
    workspaces_processed: workspaces.length,
    due_soon_notified:    totalDueSoon,
    overdue_notified:     totalOverdue,
  });
}
