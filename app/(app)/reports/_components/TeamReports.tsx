'use client';

import { useMemo } from 'react';
import { Users, Download, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportProps, ReportTimeEntry, ReportTask } from '../_types';
import { fmtMins, fmtHours, generateCSV, downloadCSV } from '../_utils';

// ── shared helpers ──────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-indigo-500',
];
function avatarColor(userId: string) {
  let hash = 0;
  for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xfffffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ── Team Workload Report ─────────────────────────────────────────────────────

interface WorkloadProps extends ReportProps {
  allEntries: ReportTimeEntry[];
  allTasks:   ReportTask[];
}

interface WorkloadRow {
  userId:    string;
  name:      string;
  assigned:  number;
  inProg:    number;
  done:      number;
  totalMins: number;
  billMins:  number;
}

export function TeamWorkloadReport({ allEntries, allTasks, members, filters }: WorkloadProps) {
  const rows = useMemo((): WorkloadRow[] => {
    const map = new Map<string, WorkloadRow>();

    for (const m of members) {
      map.set(m.user_id, { userId: m.user_id, name: m.name, assigned: 0, inProg: 0, done: 0, totalMins: 0, billMins: 0 });
    }

    for (const t of allTasks) {
      if (!t.assignee_id) continue;
      if (filters.projectId && t.project_id !== filters.projectId) continue;
      const row = map.get(t.assignee_id);
      if (!row) continue;
      row.assigned++;
      if (t.status === 'in_progress') row.inProg++;
      if (t.status === 'done')        row.done++;
    }

    for (const e of allEntries) {
      if (filters.projectId && e.project_id !== filters.projectId) continue;
      const row = map.get(e.user_id);
      if (!row) continue;
      row.totalMins += e.duration_minutes ?? 0;
      if (e.billable) row.billMins += e.duration_minutes ?? 0;
    }

    return Array.from(map.values())
      .filter(r => r.assigned > 0 || r.totalMins > 0)
      .sort((a, b) => b.totalMins - a.totalMins);
  }, [allEntries, allTasks, members, filters]);

  const maxMins    = Math.max(...rows.map(r => r.totalMins), 1);
  const maxTasks   = Math.max(...rows.map(r => r.assigned), 1);
  const totalHours = rows.reduce((s, r) => s + r.totalMins, 0);

  function handleExport() {
    const csv = generateCSV(
      ['Member', 'Tasks Assigned', 'In Progress', 'Completed', 'Total Hours', 'Billable Hours', 'Completion Rate %'],
      rows.map(r => [
        r.name, r.assigned, r.inProg, r.done,
        (r.totalMins / 60).toFixed(1), (r.billMins / 60).toFixed(1),
        r.assigned > 0 ? Math.round((r.done / r.assigned) * 100) : 0,
      ]),
    );
    downloadCSV(csv, 'team-workload');
  }

  if (rows.length === 0) {
    return (
      <div className="tc-card flex flex-col items-center justify-center py-20 text-center">
        <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="font-medium text-sm">No team data yet</p>
        <p className="text-xs text-muted-foreground mt-1">Assign tasks and log time to see workload.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Team members',    value: rows.length },
          { label: 'Total hours',     value: fmtMins(totalHours) },
          { label: 'Total tasks',     value: rows.reduce((s, r) => s + r.assigned, 0) },
          { label: 'Tasks completed', value: rows.reduce((s, r) => s + r.done, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="tc-card px-4 py-4 text-center">
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Hours per member */}
      <div className="tc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Hours logged per member</p>
          <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5 print:hidden">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
        <div className="divide-y divide-border">
          {rows.map((r) => {
            const pct = maxMins > 0 ? (r.totalMins / maxMins) * 100 : 0;
            const billPct = r.totalMins > 0 ? Math.round((r.billMins / r.totalMins) * 100) : 0;
            return (
              <div key={r.userId} className="report-row px-5 py-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold', avatarColor(r.userId))}>
                    {initials(r.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                        <span className="tabular-nums hidden sm:block">{fmtMins(r.totalMins)}</span>
                        <span className="tabular-nums">{billPct}% bill.</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-11">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-16 text-right shrink-0">{fmtMins(r.totalMins)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tasks per member */}
      <div className="tc-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Tasks per member</p>
        </div>
        <div className="grid grid-cols-4 gap-4 px-5 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
          <span className="col-span-2">Member</span>
          <span className="text-right">Tasks</span>
          <span className="text-right">Done</span>
        </div>
        <div className="divide-y divide-border">
          {rows.map((r) => {
            const taskPct = r.assigned > 0 ? (r.assigned / maxTasks) * 100 : 0;
            const donePct = r.assigned > 0 ? Math.round((r.done / r.assigned) * 100) : 0;
            return (
              <div key={r.userId} className="report-row grid grid-cols-4 gap-4 items-center px-5 py-3">
                <div className="col-span-2 flex items-center gap-2.5 min-w-0">
                  <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-bold', avatarColor(r.userId))}>
                    {initials(r.name)}
                  </div>
                  <p className="text-sm truncate">{r.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums font-medium">{r.assigned}</p>
                  {r.inProg > 0 && <p className="text-xs text-muted-foreground">{r.inProg} active</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums font-medium">{r.done}</p>
                  {r.assigned > 0 && <p className="text-xs text-muted-foreground">{donePct}%</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Team Productivity Report ─────────────────────────────────────────────────

interface ProductivityProps extends ReportProps {
  allTasks: ReportTask[];
}

interface ProdRow {
  userId:         string;
  name:           string;
  total:          number;
  done:           number;
  inProgress:     number;
  blocked:        number;
  completionRate: number;
  avgHours:       number | null;
}

export function TeamProductivityReport({ allTasks, members, filters }: ProductivityProps) {
  const rows = useMemo((): ProdRow[] => {
    const map = new Map<string, { total: number; done: number; inProg: number; completedHours: number; completedCount: number }>();

    for (const m of members) {
      map.set(m.user_id, { total: 0, done: 0, inProg: 0, completedHours: 0, completedCount: 0 });
    }

    for (const t of allTasks) {
      if (!t.assignee_id) continue;
      if (filters.projectId && t.project_id !== filters.projectId) continue;
      const s = map.get(t.assignee_id);
      if (!s) continue;
      s.total++;
      if (t.status === 'done') {
        s.done++;
        s.completedHours += t.actual_hours ?? 0;
        s.completedCount++;
      }
      if (t.status === 'in_progress') s.inProg++;
    }

    return members
      .map((m) => {
        const s = map.get(m.user_id) ?? { total: 0, done: 0, inProg: 0, completedHours: 0, completedCount: 0 };
        return {
          userId:         m.user_id,
          name:           m.name,
          total:          s.total,
          done:           s.done,
          inProgress:     s.inProg,
          blocked:        0,
          completionRate: s.total > 0 ? Math.round((s.done / s.total) * 100) : 0,
          avgHours:       s.completedCount > 0 ? s.completedHours / s.completedCount : null,
        };
      })
      .filter(r => r.total > 0)
      .sort((a, b) => b.completionRate - a.completionRate);
  }, [allTasks, members, filters]);

  const avgCompletionRate = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.completionRate, 0) / rows.length)
    : 0;

  const topPerformer = rows[0];

  function handleExport() {
    const csv = generateCSV(
      ['Member', 'Total Tasks', 'Completed', 'In Progress', 'Completion Rate %', 'Avg Hours/Task'],
      rows.map(r => [
        r.name, r.total, r.done, r.inProgress,
        r.completionRate,
        r.avgHours != null ? r.avgHours.toFixed(1) : '',
      ]),
    );
    downloadCSV(csv, 'team-productivity');
  }

  if (rows.length === 0) {
    return (
      <div className="tc-card flex flex-col items-center justify-center py-20 text-center">
        <Trophy className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="font-medium text-sm">No productivity data yet</p>
        <p className="text-xs text-muted-foreground mt-1">Assign and complete tasks to see team productivity.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Team size',         value: rows.length },
          { label: 'Avg completion',    value: `${avgCompletionRate}%` },
          { label: 'Top performer',     value: topPerformer?.name ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="tc-card px-4 py-4 text-center">
            <p className="text-xl font-bold tabular-nums truncate">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Completion rate bars */}
      <div className="tc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Completion rate by member</p>
          <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5 print:hidden">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
        <div className="divide-y divide-border">
          {rows.map((r, i) => (
            <div key={r.userId} className="report-row px-5 py-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold', avatarColor(r.userId))}>
                  {initials(r.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      {i === 0 && (
                        <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold shrink-0">
                          Top
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold tabular-nums shrink-0">{r.completionRate}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-11">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', r.completionRate >= 80 ? 'bg-emerald-500' : r.completionRate >= 50 ? 'bg-primary' : 'bg-orange-400')}
                    style={{ width: `${r.completionRate}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-24 text-right shrink-0">
                  {r.done}/{r.total} tasks
                </span>
              </div>
              {r.avgHours != null && (
                <p className="text-xs text-muted-foreground pl-11">
                  Avg {r.avgHours.toFixed(1)}h per completed task · {r.inProgress} in progress
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Summary grid */}
      <div className="tc-card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">Summary</p>
        </div>
        <div className="grid grid-cols-5 gap-4 px-5 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
          <span className="col-span-2">Member</span>
          <span className="text-right">Total</span>
          <span className="text-right">Done</span>
          <span className="text-right">Rate</span>
        </div>
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.userId} className="report-row grid grid-cols-5 gap-4 items-center px-5 py-3">
              <div className="col-span-2 flex items-center gap-2 min-w-0">
                <div className={cn('h-2 w-2 rounded-full shrink-0', r.completionRate >= 80 ? 'bg-emerald-500' : r.completionRate >= 50 ? 'bg-primary' : 'bg-orange-400')} />
                <p className="text-sm truncate">{r.name}</p>
              </div>
              <p className="text-sm tabular-nums text-right">{r.total}</p>
              <p className="text-sm tabular-nums text-right">{r.done}</p>
              <p className={cn('text-sm tabular-nums font-medium text-right', r.completionRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : r.completionRate >= 50 ? 'text-primary' : 'text-orange-500')}>
                {r.completionRate}%
              </p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3">
          <span className="text-xs text-muted-foreground">Team average</span>
          <span className="text-sm font-bold">{avgCompletionRate}%</span>
        </div>
      </div>
    </div>
  );
}
