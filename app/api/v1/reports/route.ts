import { prisma } from '@/lib/prisma';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  const profile = await prisma.profile.findUnique({ where: { id: ctx.userId }, select: { plan: true } });
  if (!['solo', 'team'].includes(profile?.plan ?? '')) {
    return apiError('PLAN_REQUIRED', 'Reports API requires a Solo or Team plan.', 403);
  }

  const url      = new URL(req.url);
  const type     = url.searchParams.get('type') ?? 'summary';
  const dateFrom = url.searchParams.get('date_from');
  const dateTo   = url.searchParams.get('date_to');
  const wid      = ctx.workspaceId;

  if (type === 'summary') {
    const [projects, tasks, entries] = await Promise.all([
      prisma.project.findMany({ where: { workspaceId: wid }, select: { id: true, status: true } }),
      prisma.task.findMany({ where: { workspaceId: wid }, select: { id: true, status: true } }),
      prisma.timeEntry.findMany({
        where: { workspaceId: wid, durationMinutes: { not: null } },
        select: { durationMinutes: true, billable: true, hourlyRate: true },
      }),
    ]);

    const totalMins    = entries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const billableMins = entries.filter((e) => e.billable).reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    const billableValue = entries
      .filter((e) => e.billable && e.hourlyRate)
      .reduce((s, e) => s + ((e.durationMinutes ?? 0) / 60) * Number(e.hourlyRate ?? 0), 0);

    return apiSuccess({
      projects: {
        total:     projects.length,
        active:    projects.filter((p) => p.status === 'active').length,
        completed: projects.filter((p) => p.status === 'completed').length,
      },
      tasks: {
        total:           tasks.length,
        done:            tasks.filter((t) => t.status === 'done').length,
        in_progress:     tasks.filter((t) => t.status === 'in_progress').length,
        completion_rate: tasks.length ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100) : 0,
      },
      time: {
        total_minutes:    totalMins,
        billable_minutes: billableMins,
        billable_value:   Math.round(billableValue * 100) / 100,
        billable_rate:    totalMins ? Math.round((billableMins / totalMins) * 100) : 0,
      },
    });
  }

  if (type === 'time') {
    const entries = await prisma.timeEntry.findMany({
      where: {
        workspaceId: wid,
        durationMinutes: { not: null },
        ...(dateFrom || dateTo ? { startTime: {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo   ? { lte: new Date(dateTo) }   : {}),
        } } : {}),
      },
      select: {
        projectId: true, userId: true, durationMinutes: true, billable: true, hourlyRate: true, startTime: true,
        project: { select: { name: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 500,
    });

    const byProject: Record<string, { name: string; minutes: number; billable_minutes: number; value: number }> = {};
    for (const e of entries) {
      const pid = e.projectId ?? 'no_project';
      if (!byProject[pid]) byProject[pid] = { name: e.project?.name ?? 'No project', minutes: 0, billable_minutes: 0, value: 0 };
      byProject[pid].minutes += e.durationMinutes ?? 0;
      if (e.billable) byProject[pid].billable_minutes += e.durationMinutes ?? 0;
      if (e.billable && e.hourlyRate) byProject[pid].value += ((e.durationMinutes ?? 0) / 60) * Number(e.hourlyRate);
    }

    return apiSuccess({
      by_project: Object.entries(byProject).map(([id, v]) => ({ project_id: id, ...v })),
      date_from:  dateFrom,
      date_to:    dateTo,
    });
  }

  return apiError('VALIDATION', `Unknown report type "${type}". Supported: summary, time.`, 422);
}
