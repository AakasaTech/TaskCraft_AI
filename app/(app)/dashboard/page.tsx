import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CheckSquare, Clock, FolderKanban, TrendingUp, AlertTriangle,
  Calendar, ArrowRight, Play, Users, Activity,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { StatCard } from '@/components/shared/StatCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { TimerWidget } from '@/components/shared/TimerWidget';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { QuickActionsBar } from './_components/QuickActionsBar';
import { TasksWidget } from './_components/TasksWidget';
import { AiFocusWidget } from './_components/AiFocusWidget';
import type { DashTask } from './_components/TasksWidget';
import type { FocusTask } from './_components/AiFocusWidget';
import type { TaskStatus, TaskPriority } from '@/lib/types';

export const metadata: Metadata = { title: 'Dashboard' };

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function minutesToHours(mins: number): string {
  const h = mins / 60;
  return h === 0 ? '0h' : h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

function formatDueDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((date.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ACTION_LABEL: Record<string, string> = {
  created:          'created',
  status_changed:   'updated status on',
  priority_changed: 'changed priority of',
  assignee_changed: 'updated assignee on',
  due_date_changed: 'changed due date on',
  comment_added:    'commented on',
  attachment_added: 'attached a file to',
  label_added:      'added a label to',
  label_removed:    'removed a label from',
};

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchDashboardData() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Workspace (first membership, ordered by join date)
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return { empty: true as const, user };

  const wid = membership.workspace_id;
  const uid = user.id;

  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const monday     = getMonday(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Run independent queries in parallel
  const [
    openCount,
    overdueCount,
    todayCount,
    weekTime,
    monthBillable,
    activeProjectsCount,
    myTasksRaw,
    projectsRaw,
    upcomingRaw,
    activityRaw,
    completedWeekCount,
    runningTimer,
  ] = await Promise.all([
    // Open tasks (not done)
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wid)
      .neq('status', 'done'),

    // Overdue (past due, not done)
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wid)
      .neq('status', 'done')
      .lt('due_date', todayStart.toISOString())
      .not('due_date', 'is', null),

    // Due today (not done)
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wid)
      .neq('status', 'done')
      .gte('due_date', todayStart.toISOString())
      .lte('due_date', todayEnd.toISOString()),

    // Time entries this week
    supabase
      .from('time_entries')
      .select('duration_minutes, billable')
      .eq('workspace_id', wid)
      .eq('user_id', uid)
      .gte('start_time', monday.toISOString())
      .not('duration_minutes', 'is', null),

    // Billable time this month
    supabase
      .from('time_entries')
      .select('duration_minutes')
      .eq('workspace_id', wid)
      .eq('user_id', uid)
      .eq('billable', true)
      .gte('start_time', monthStart.toISOString())
      .not('duration_minutes', 'is', null),

    // Active projects count
    supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wid)
      .eq('status', 'active'),

    // My open tasks (assigned to me)
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, projects(name, color)')
      .eq('workspace_id', wid)
      .eq('assignee_id', uid)
      .neq('status', 'done')
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(12),

    // Active projects
    supabase
      .from('projects')
      .select('id, name, color, status, due_date')
      .eq('workspace_id', wid)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),

    // Upcoming deadlines (next 7 days)
    supabase
      .from('tasks')
      .select('id, title, due_date, priority, status, projects(name, color)')
      .eq('workspace_id', wid)
      .neq('status', 'done')
      .gte('due_date', todayStart.toISOString())
      .lte('due_date', new Date(now.getTime() + 7 * 86_400_000).toISOString())
      .order('due_date', { ascending: true })
      .limit(8),

    // Recent activity
    supabase
      .from('task_activity')
      .select('id, action, created_at, tasks!inner(id, title, workspace_id), profiles(full_name, avatar_url)')
      .eq('tasks.workspace_id', wid)
      .order('created_at', { ascending: false })
      .limit(10),

    // Tasks completed this week
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wid)
      .eq('status', 'done')
      .gte('completed_at', monday.toISOString()),

    // Running timer (if any)
    supabase
      .from('time_entries')
      .select('id, description, task_id, start_time, tasks(title)')
      .eq('user_id', uid)
      .eq('workspace_id', wid)
      .is('end_time', null)
      .maybeSingle(),
  ]);

  // Compute project task stats
  const projectIds = (projectsRaw.data ?? []).map((p: { id: string }) => p.id);
  const projectTaskStats: Record<string, { total: number; done: number }> = {};
  if (projectIds.length > 0) {
    const { data: ptRaw } = await supabase
      .from('tasks')
      .select('project_id, status')
      .eq('workspace_id', wid)
      .in('project_id', projectIds);
    for (const t of ptRaw ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = t as any;
      const pid: string = rec.project_id;
      if (!projectTaskStats[pid]) projectTaskStats[pid] = { total: 0, done: 0 };
      projectTaskStats[pid].total++;
      if (rec.status === 'done') projectTaskStats[pid].done++;
    }
  }

  // Derived stats
  const weekMins   = (weekTime.data ?? []).reduce((s, e) => s + ((e as { duration_minutes: number }).duration_minutes ?? 0), 0);
  const monthMins  = (monthBillable.data ?? []).reduce((s, e) => s + ((e as { duration_minutes: number }).duration_minutes ?? 0), 0);

  // Shape my tasks
  const todayISO = todayStart.toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myTasks: DashTask[] = (myTasksRaw.data ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    due_date: t.due_date,
    project_name: Array.isArray(t.projects) ? (t.projects[0]?.name ?? null) : (t.projects?.name ?? null),
    project_color: Array.isArray(t.projects) ? (t.projects[0]?.color ?? null) : (t.projects?.color ?? null),
    is_overdue: !!t.due_date && t.due_date < todayISO,
  }));

  const todayTasks  = myTasks.filter((t) => t.due_date && t.due_date >= todayISO && t.due_date <= todayEnd.toISOString());
  const overdueTasks = myTasks.filter((t) => t.is_overdue);

  // AI focus: top 5 by urgency (urgent/high priority + earliest due)
  const focusTasks: FocusTask[] = myTasks
    .sort((a, b) => {
      const pOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return pOrder[a.priority] - pOrder[b.priority];
    })
    .slice(0, 5)
    .map((t) => ({
      title: t.title,
      reason: t.is_overdue
        ? 'Overdue — needs immediate attention'
        : t.due_date && new Date(t.due_date) <= todayEnd
          ? 'Due today'
          : t.priority === 'urgent'
            ? 'Marked urgent'
            : t.priority === 'high'
              ? 'High priority task'
              : 'Assigned to you',
      priority: t.priority,
    }));

  // Active projects with stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects = (projectsRaw.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    due_date: p.due_date,
    stats: projectTaskStats[p.id] ?? { total: 0, done: 0 },
  }));

  // Upcoming deadlines
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upcoming = (upcomingRaw.data ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    priority: t.priority as TaskPriority,
    project_name: Array.isArray(t.projects) ? (t.projects[0]?.name ?? null) : (t.projects?.name ?? null),
    project_color: Array.isArray(t.projects) ? (t.projects[0]?.color ?? null) : (t.projects?.color ?? null),
  }));

  // Recent activity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activity = (activityRaw.data ?? []).map((a: any) => ({
    id: a.id,
    action: a.action,
    task_title: Array.isArray(a.tasks) ? (a.tasks[0]?.title ?? 'a task') : (a.tasks?.title ?? 'a task'),
    user_name: Array.isArray(a.profiles) ? (a.profiles[0]?.full_name ?? 'Someone') : (a.profiles?.full_name ?? 'Someone'),
    avatar_url: Array.isArray(a.profiles) ? (a.profiles[0]?.avatar_url ?? null) : (a.profiles?.avatar_url ?? null),
    created_at: a.created_at,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runningTimerRec = runningTimer.data as any;
  const runningTask: string | null = Array.isArray(runningTimerRec?.tasks)
    ? (runningTimerRec.tasks[0]?.title ?? null)
    : (runningTimerRec?.tasks?.title ?? null);

  return {
    user,
    stats: {
      openTasks:        openCount.count ?? 0,
      overdueTasks:     overdueCount.count ?? 0,
      todayTasks:       todayCount.count ?? 0,
      weekMins,
      monthMins,
      activeProjects:   activeProjectsCount.count ?? 0,
      completedWeek:    completedWeekCount.count ?? 0,
    },
    myTasks,
    todayTasks,
    overdueTasks,
    projects,
    upcoming,
    activity,
    focusTasks,
    runningTask,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workspaceName: Array.isArray((membership as any).workspaces)
      ? ((membership as any).workspaces[0]?.name ?? 'My Workspace')
      : ((membership as any).workspaces?.name ?? 'My Workspace'),
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const data = await fetchDashboardData();

  if (!data || 'empty' in data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <FolderKanban className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-bold">Setting up your workspace</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Your personal workspace is being created. Refresh in a moment.
        </p>
      </div>
    );
  }

  const { stats, myTasks, todayTasks, overdueTasks, projects, upcoming, activity, focusTasks, runningTask } = data;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = data.user.user_metadata?.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <PageHeader
        title={`${greeting}, ${firstName}`}
        subtitle={stats.overdueTasks > 0
          ? `You have ${stats.overdueTasks} overdue task${stats.overdueTasks > 1 ? 's' : ''} that need attention.`
          : 'Your productivity at a glance.'}
        actions={
          <div className="flex items-center gap-2">
            <TimerWidget taskName={runningTask ?? undefined} />
            <Link href="/tasks" className="tc-btn-primary">
              <CheckSquare className="h-3.5 w-3.5" />
              New Task
            </Link>
          </div>
        }
      />

      {/* Overdue alert banner */}
      {stats.overdueTasks > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            <strong>{stats.overdueTasks}</strong> task{stats.overdueTasks > 1 ? 's are' : ' is'} overdue.
            {' '}
            <button
              onClick={() => {}}
              className="font-semibold underline hover:no-underline"
            >
              Review now →
            </button>
          </p>
        </div>
      )}

      {/* KPI stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Open Tasks"
          value={stats.openTasks}
          subtitle={stats.overdueTasks > 0 ? `${stats.overdueTasks} overdue` : 'across all projects'}
          icon={CheckSquare}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          trend={stats.completedWeek > 0 ? { value: stats.completedWeek, label: 'completed this week' } : undefined}
        />
        <StatCard
          title="Due Today"
          value={stats.todayTasks}
          subtitle="tasks to complete today"
          icon={Calendar}
          iconBg="bg-amber-100 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          title="Hours This Week"
          value={minutesToHours(stats.weekMins)}
          subtitle="time tracked since Monday"
          icon={Clock}
          iconBg="bg-sky-100 dark:bg-sky-900/30"
          iconColor="text-sky-600 dark:text-sky-400"
        />
        <StatCard
          title="Billable This Month"
          value={minutesToHours(stats.monthMins)}
          subtitle={`${stats.activeProjects} active project${stats.activeProjects !== 1 ? 's' : ''}`}
          icon={TrendingUp}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* Quick Actions */}
      <QuickActionsBar />

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Left column (2/3) ── */}
        <div className="space-y-6 lg:col-span-2">

          {/* My Tasks widget */}
          <TasksWidget all={myTasks} today={todayTasks} overdue={overdueTasks} />

          {/* Active Projects */}
          <div className="tc-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Active Projects</h2>
              <Link
                href="/projects"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No active projects</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Create a project to organise your tasks.
                </p>
                <Link href="/projects" className="tc-btn-primary mt-4 text-xs">
                  Create project
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {projects.map((p) => {
                  const pct = p.stats.total > 0
                    ? Math.round((p.stats.done / p.stats.total) * 100)
                    : 0;
                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                    >
                      <span
                        className="h-9 w-9 shrink-0 rounded-xl"
                        style={{ background: p.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                            {p.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {p.stats.done}/{p.stats.total} tasks
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{pct}% complete</span>
                          {p.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Due {formatDueDateShort(p.due_date)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Productivity summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="tc-card p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-lg font-bold">{stats.completedWeek}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">tasks this week</p>
            </div>
            <div className="tc-card p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/30">
                  <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg / Day</p>
                  <p className="text-lg font-bold">
                    {minutesToHours(Math.round(stats.weekMins / Math.max(new Date().getDay() || 7, 1)))}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">tracked per working day</p>
            </div>
            <div className="tc-card p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
                  <FolderKanban className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Projects</p>
                  <p className="text-lg font-bold">{stats.activeProjects}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">currently active</p>
            </div>
          </div>
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-6">

          {/* Quick Timer */}
          <div className="tc-card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Play className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Quick Timer</h2>
            </div>
            <div className="flex flex-col items-center gap-4 px-5 py-6">
              <p className="text-xs text-muted-foreground text-center">
                Track time on your current task.
              </p>
              <TimerWidget taskName={runningTask ?? undefined} />
              <Link href="/time" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                View time log →
              </Link>
            </div>
          </div>

          {/* Upcoming Deadlines */}
          <div className="tc-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Upcoming Deadlines</h2>
              <Link
                href="/tasks"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No deadlines in the next 7 days.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    {t.project_color && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: t.project_color }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      {t.project_name && (
                        <p className="text-xs text-muted-foreground">{t.project_name}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <PriorityBadge priority={t.priority} iconOnly />
                      <span className="text-xs text-muted-foreground">
                        {formatDueDateShort(t.due_date)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI Focus List */}
          <AiFocusWidget initial={focusTasks} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="tc-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Recent Activity</h2>
          </div>
        </div>

        {activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                {/* Avatar */}
                {a.avatar_url ? (
                  <img
                    src={a.avatar_url}
                    alt={a.user_name ?? ''}
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {(a.user_name ?? 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <strong>{a.user_name}</strong>{' '}
                    <span className="text-muted-foreground">
                      {ACTION_LABEL[a.action] ?? a.action}
                    </span>{' '}
                    <strong>{a.task_title}</strong>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
