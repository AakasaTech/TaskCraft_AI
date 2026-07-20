import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReportsClient } from './_components/ReportsClient';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import type { ReportTimeEntry, ReportProject, ReportTask, ReportMember } from './_types';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch membership + plan together before running expensive queries
  const [memberRes, profileRes] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('plan, plan_expires_at')
      .eq('id', user.id)
      .single(),
  ]);

  if (!memberRes.data) redirect('/login');
  const wid = memberRes.data.workspace_id;

  // Gate: Reports require Solo or Team plan
  const userPlan = getEffectivePlan((profileRes.data?.plan ?? 'free') as Plan, profileRes.data?.plan_expires_at ?? null);
  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Reports" subtitle="Analyse project progress, team productivity, and billable hours" />
        <UpgradePrompt feature="reports" requiredPlan="solo" />
      </div>
    );
  }

  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const [entriesRes, projectsRes, tasksRes, membersRes] = await Promise.all([
    // Time entries — last 12 months, all workspace users
    supabase
      .from('time_entries')
      .select(`
        id, project_id, task_id, user_id,
        description, start_time, duration_minutes,
        billable, hourly_rate, invoice_status,
        tasks(title),
        projects(id, name, color, client_id, clients(id, name)),
        profiles(full_name)
      `)
      .eq('workspace_id', wid)
      .not('end_time', 'is', null)
      .gte('start_time', since.toISOString())
      .order('start_time', { ascending: false })
      .limit(5000),

    // All projects (including archived for historical reports)
    supabase
      .from('projects')
      .select('id, name, color, status, client_id, due_date, budget, hourly_rate, billable, clients(id, name)')
      .eq('workspace_id', wid)
      .order('name'),

    // All top-level tasks
    supabase
      .from('tasks')
      .select(`
        id, title, status, priority,
        project_id, assignee_id,
        due_date, estimated_hours, actual_hours,
        created_at, completed_at,
        projects(name, color),
        profiles!tasks_assignee_id_fkey(full_name)
      `)
      .eq('workspace_id', wid)
      .is('parent_task_id', null)
      .order('created_at', { ascending: false })
      .limit(3000),

    // Workspace members
    supabase
      .from('workspace_members')
      .select('user_id, profiles(id, full_name, avatar_url, email)')
      .eq('workspace_id', wid),
  ]);

  // ── Shape time entries ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: ReportTimeEntry[] = (entriesRes.data ?? []).map((e: any) => {
    const task   = Array.isArray(e.tasks)    ? e.tasks[0]    : e.tasks;
    const proj   = Array.isArray(e.projects) ? e.projects[0] : e.projects;
    const client = proj ? (Array.isArray(proj.clients) ? proj.clients[0] : proj.clients) : null;
    const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    return {
      id:               e.id,
      project_id:       e.project_id,
      project_name:     proj?.name  ?? null,
      project_color:    proj?.color ?? null,
      client_id:        client?.id  ?? proj?.client_id ?? null,
      client_name:      client?.name ?? null,
      task_id:          e.task_id,
      task_title:       task?.title  ?? null,
      user_id:          e.user_id,
      user_name:        profile?.full_name ?? null,
      description:      e.description,
      start_time:       e.start_time,
      duration_minutes: e.duration_minutes,
      billable:         e.billable,
      hourly_rate:      e.hourly_rate,
      invoice_status:   e.invoice_status,
    } satisfies ReportTimeEntry;
  });

  // ── Build per-project stats from tasks + entries ───────────────────
  const taskCountMap: Record<string, { total: number; done: number }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (tasksRes.data ?? []) as any[]) {
    if (!t.project_id) continue;
    if (!taskCountMap[t.project_id]) taskCountMap[t.project_id] = { total: 0, done: 0 };
    taskCountMap[t.project_id].total++;
    if (t.status === 'done') taskCountMap[t.project_id].done++;
  }
  const hoursMap: Record<string, number> = {};
  for (const e of entries) {
    if (!e.project_id) continue;
    hoursMap[e.project_id] = (hoursMap[e.project_id] ?? 0) + (e.duration_minutes ?? 0);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects: ReportProject[] = (projectsRes.data ?? []).map((p: any) => {
    const client = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    return {
      id:          p.id,
      name:        p.name,
      color:       p.color,
      status:      p.status,
      client_id:   client?.id   ?? p.client_id ?? null,
      client_name: client?.name ?? null,
      due_date:    p.due_date,
      budget:      p.budget,
      hourly_rate: p.hourly_rate,
      billable:    p.billable,
      task_total:  taskCountMap[p.id]?.total ?? 0,
      task_done:   taskCountMap[p.id]?.done  ?? 0,
      hours_logged: Math.round((hoursMap[p.id] ?? 0) * 10) / 10,
    } satisfies ReportProject;
  });

  // ── Shape tasks ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: ReportTask[] = (tasksRes.data ?? []).map((t: any) => {
    const proj    = Array.isArray(t.projects) ? t.projects[0] : t.projects;
    const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
    return {
      id:              t.id,
      title:           t.title,
      status:          t.status,
      priority:        t.priority,
      project_id:      t.project_id,
      project_name:    proj?.name     ?? null,
      project_color:   proj?.color    ?? null,
      assignee_id:     t.assignee_id,
      assignee_name:   profile?.full_name ?? null,
      due_date:        t.due_date,
      estimated_hours: t.estimated_hours,
      actual_hours:    t.actual_hours ?? 0,
      created_at:      t.created_at,
      completed_at:    t.completed_at,
    } satisfies ReportTask;
  });

  // ── Shape members ────────────��───────────────────────���─────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: ReportMember[] = (membersRes.data ?? []).map((m: any) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      user_id:    m.user_id,
      name:       p?.full_name ?? p?.email ?? 'Unknown',
      email:      p?.email     ?? null,
      avatar_url: p?.avatar_url ?? null,
    } satisfies ReportMember;
  });

  // Unique client list for filter dropdown
  const clientSet = new Map<string, string>();
  for (const p of projects) {
    if (p.client_id && p.client_name) clientSet.set(p.client_id, p.client_name);
  }
  const clients = Array.from(clientSet.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isTeamPlan = userPlan === 'team';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Analyse project progress, team productivity, and billable hours"
      />
      <ReportsClient
        entries={entries}
        projects={projects}
        tasks={tasks}
        members={members}
        clients={clients}
        isTeamPlan={isTeamPlan}
        currentUserId={user.id}
      />
    </div>
  );
}
