import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CheckSquare, Clock, FolderKanban, TrendingUp, AlertTriangle,
  Calendar, ArrowRight, Play, Users, Activity,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
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
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const wid = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const monday     = getMonday(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const next7Days  = new Date(now.getTime() + 7 * 86_400_000);

  // Run independent queries in parallel via Prisma
  const [
    openTasksCount,
    overdueTasksCount,
    todayTasksCount,
    weekTimeEntries,
    monthBillableEntries,
    activeProjectsCount,
    myTasksRaw,
    projectsRaw,
    upcomingRaw,
    activityRaw,
    completedWeekCount,
    runningTimer,
  ] = await Promise.all([
    // Open tasks (not done)
    prisma.task.count({
      where: { workspaceId: wid, status: { not: 'done' } },
    }),

    // Overdue
    prisma.task.count({
      where: {
        workspaceId: wid,
        status: { not: 'done' },
        dueDate: { lt: todayStart },
      },
    }),

    // Due today
    prisma.task.count({
      where: {
        workspaceId: wid,
        status: { not: 'done' },
        dueDate: { gte: todayStart, lte: todayEnd },
      },
    }),

    // Time entries this week
    prisma.timeEntry.findMany({
      where: {
        workspaceId: wid,
        userId: uid,
        startTime: { gte: monday },
        durationMinutes: { not: null },
      },
      select: { durationMinutes: true, billable: true },
    }),

    // Billable time this month
    prisma.timeEntry.findMany({
      where: {
        workspaceId: wid,
        userId: uid,
        billable: true,
        startTime: { gte: monthStart },
        durationMinutes: { not: null },
      },
      select: { durationMinutes: true },
    }),

    // Active projects count
    prisma.project.count({
      where: { workspaceId: wid, status: 'active' },
    }),

    // My open tasks
    prisma.task.findMany({
      where: {
        workspaceId: wid,
        assigneeId: uid,
        status: { not: 'done' },
      },
      include: {
        project: { select: { name: true, color: true } },
      },
      orderBy: [
        { dueDate: 'asc' },
      ],
      take: 12,
    }),

    // Active projects with task stats
    prisma.project.findMany({
      where: { workspaceId: wid, status: 'active' },
      include: {
        tasks: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),

    // Upcoming deadlines (next 7 days)
    prisma.task.findMany({
      where: {
        workspaceId: wid,
        status: { not: 'done' },
        dueDate: { gte: todayStart, lte: next7Days },
      },
      include: {
        project: { select: { name: true, color: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 8,
    }),

    // Recent activity
    prisma.taskActivity.findMany({
      where: {
        task: { workspaceId: wid },
      },
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { fullName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),

    // Tasks completed this week
    prisma.task.count({
      where: {
        workspaceId: wid,
        status: 'done',
        completedAt: { gte: monday },
      },
    }),

    // Running timer
    prisma.timeEntry.findFirst({
      where: {
        workspaceId: wid,
        userId: uid,
        endTime: null,
      },
      include: {
        task: { select: { title: true } },
      },
    }),
  ]);

  // Derived stats
  const weekMins = weekTimeEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  const monthMins = monthBillableEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);

  // Shape my tasks
  const todayISO = todayStart.toISOString();
  const myTasks: DashTask[] = myTasksRaw.map((t) => {
    const dueStr = t.dueDate ? t.dueDate.toISOString().split('T')[0] : null;
    return {
      id: t.id,
      title: t.title,
      status: t.status as TaskStatus,
      priority: t.priority as TaskPriority,
      due_date: dueStr,
      project_name: t.project?.name ?? null,
      project_color: t.project?.color ?? null,
      is_overdue: Boolean(t.dueDate && t.dueDate < todayStart),
    };
  });

  const todayTasks = myTasks.filter((t) => t.due_date && t.due_date >= todayISO.split('T')[0] && t.due_date <= todayEnd.toISOString().split('T')[0]);
  const overdueTasks = myTasks.filter((t) => t.is_overdue);

  // AI focus: top 5 by urgency
  const focusTasks: FocusTask[] = [...myTasks]
    .sort((a, b) => {
      const pOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
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
  const projects = projectsRaw.map((p) => {
    const total = p.tasks.length;
    const done = p.tasks.filter((t) => t.status === 'done').length;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      due_date: p.dueDate ? p.dueDate.toISOString().split('T')[0] : null,
      stats: { total, done },
    };
  });

  // Upcoming deadlines
  const upcoming = upcomingRaw.map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
    priority: t.priority as TaskPriority,
    project_name: t.project?.name ?? null,
    project_color: t.project?.color ?? null,
  }));

  // Recent activity
  const activity = activityRaw.map((a) => ({
    id: a.id,
    action: a.action,
    task_title: a.task?.title ?? 'a task',
    user_name: a.user?.fullName ?? 'Someone',
    avatar_url: a.user?.avatarUrl ?? null,
    created_at: a.createdAt.toISOString(),
  }));

  return {
    user: {
      id: currentUser.id,
      email: currentUser.email,
      fullName: currentUser.profile.fullName,
    },
    stats: {
      openTasks: openTasksCount,
      overdueTasks: overdueTasksCount,
      todayTasks: todayTasksCount,
      weekMins,
      monthMins,
      activeProjects: activeProjectsCount,
      completedWeek: completedWeekCount,
    },
    myTasks,
    todayTasks,
    overdueTasks,
    projects,
    upcoming,
    activity,
    focusTasks,
    runningTask: runningTimer?.task?.title ?? null,
    workspaceName: currentUser.workspace.name,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const data = await fetchDashboardData();

  if (!data) {
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
  const firstName = data.user.fullName?.split(' ')[0] || data.user.email.split('@')[0] || 'there';

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
            <strong>{stats.overdueTasks}</strong> task{stats.overdueTasks > 1 ? 's are' : ' is'} overdue.{' '}
            <Link href="/tasks" className="font-semibold underline hover:no-underline">
              Review now →
            </Link>
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
                        {formatDueDateShort(t.due_date || '')}
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
                {a.avatar_url ? (
                  <img
                    src={a.avatar_url}
                    alt={a.user_name}
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {(a.user_name || 'U')[0].toUpperCase()}
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
