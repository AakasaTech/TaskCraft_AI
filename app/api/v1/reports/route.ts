import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiKey, hasScope } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = await authenticateApiKey(req);
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key.', 401);
  if (!hasScope(ctx, 'read')) return apiError('FORBIDDEN', 'Read scope required.', 403);

  // Check solo+ plan
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('plan').eq('id', ctx.userId).single();
  if (!['solo', 'team'].includes(profile?.plan ?? '')) {
    return apiError('PLAN_REQUIRED', 'Reports API requires a Solo or Team plan.', 403);
  }

  const url      = new URL(req.url);
  const type     = url.searchParams.get('type') ?? 'summary';
  const dateFrom = url.searchParams.get('date_from');
  const dateTo   = url.searchParams.get('date_to');
  const wid      = ctx.workspaceId;

  if (type === 'summary') {
    const [projectsRes, tasksRes, timeRes] = await Promise.all([
      admin.from('projects').select('id, status', { count: 'exact' }).eq('workspace_id', wid),
      admin.from('tasks').select('id, status', { count: 'exact' }).eq('workspace_id', wid),
      admin.from('time_entries')
        .select('duration_minutes, billable, hourly_rate')
        .eq('workspace_id', wid)
        .not('duration_minutes', 'is', null),
    ]);

    const entries = timeRes.data ?? [];
    const totalMins    = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
    const billableMins = entries.filter((e) => e.billable).reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
    const billableValue = entries
      .filter((e) => e.billable && e.hourly_rate)
      .reduce((s, e) => s + ((e.duration_minutes ?? 0) / 60) * (e.hourly_rate ?? 0), 0);

    const tasks    = tasksRes.data ?? [];
    const projects = projectsRes.data ?? [];

    return apiSuccess({
      projects: {
        total:     projects.length,
        active:    projects.filter((p) => p.status === 'active').length,
        completed: projects.filter((p) => p.status === 'completed').length,
      },
      tasks: {
        total:     tasks.length,
        done:      tasks.filter((t) => t.status === 'done').length,
        in_progress: tasks.filter((t) => t.status === 'in_progress').length,
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
    let query = admin
      .from('time_entries')
      .select('project_id, user_id, duration_minutes, billable, hourly_rate, started_at, projects(name)')
      .eq('workspace_id', wid)
      .not('duration_minutes', 'is', null)
      .order('started_at', { ascending: false })
      .limit(500);

    if (dateFrom) query = query.gte('started_at', dateFrom);
    if (dateTo)   query = query.lte('started_at', dateTo);

    const { data, error } = await query;
    if (error) return apiError('INTERNAL', error.message, 500);

    // Group by project
    const byProject: Record<string, { name: string; minutes: number; billable_minutes: number; value: number }> = {};
    for (const e of (data ?? [])) {
      const pid  = e.project_id ?? 'no_project';
      const proj = Array.isArray(e.projects) ? e.projects[0] : e.projects;
      if (!byProject[pid]) byProject[pid] = { name: proj?.name ?? 'No project', minutes: 0, billable_minutes: 0, value: 0 };
      byProject[pid].minutes          += e.duration_minutes ?? 0;
      if (e.billable) byProject[pid].billable_minutes += e.duration_minutes ?? 0;
      if (e.billable && e.hourly_rate) byProject[pid].value += ((e.duration_minutes ?? 0) / 60) * e.hourly_rate;
    }

    return apiSuccess({
      by_project: Object.entries(byProject).map(([id, v]) => ({ project_id: id, ...v })),
      date_from:  dateFrom,
      date_to:    dateTo,
    });
  }

  return apiError('VALIDATION', `Unknown report type "${type}". Supported: summary, time.`, 422);
}
