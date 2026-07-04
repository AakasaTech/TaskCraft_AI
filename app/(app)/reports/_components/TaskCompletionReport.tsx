'use client';

import { useMemo } from 'react';
import { CheckSquare, Download, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportProps } from '../_types';
import { fmtDate, generateCSV, downloadCSV } from '../_utils';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  backlog:     { label: 'Backlog',      color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',   dot: 'bg-slate-400' },
  todo:        { label: 'To Do',        color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',   dot: 'bg-slate-500' },
  in_progress: { label: 'In Progress',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',    dot: 'bg-blue-500'  },
  in_review:   { label: 'In Review',    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', dot: 'bg-yellow-500' },
  done:        { label: 'Done',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'text-green-600'  },
  medium: { label: 'Medium', color: 'text-yellow-600' },
  high:   { label: 'High',   color: 'text-orange-600' },
  urgent: { label: 'Urgent', color: 'text-red-600'    },
};

export function TaskCompletionReport({ tasks }: ReportProps) {
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const total        = tasks.length;
  const doneCount    = statusCounts.done ?? 0;
  const completionPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // By-project completion
  const byProject = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number; done: number }>();
    for (const t of tasks) {
      const key = t.project_id ?? '__none__';
      const existing = map.get(key) ?? { name: t.project_name ?? 'No project', color: t.project_color ?? '#94a3b8', total: 0, done: 0 };
      existing.total++;
      if (t.status === 'done') existing.done++;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [tasks]);

  function handleExport() {
    const csv = generateCSV(
      ['Task', 'Project', 'Assignee', 'Status', 'Priority', 'Due Date', 'Completed At'],
      tasks.map(t => [
        t.title, t.project_name ?? '', t.assignee_name ?? '',
        STATUS_CONFIG[t.status]?.label ?? t.status,
        PRIORITY_CONFIG[t.priority]?.label ?? t.priority,
        fmtDate(t.due_date), fmtDate(t.completed_at),
      ]),
    );
    downloadCSV(csv, 'task-completion');
  }

  const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total tasks',      value: total },
          { label: 'Completed',        value: doneCount },
          { label: 'Completion rate',  value: `${completionPct}%` },
          { label: 'In progress',      value: statusCounts.in_progress ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="tc-card px-4 py-4 text-center">
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Status distribution */}
      <div className="tc-card p-5 space-y-3">
        <p className="text-sm font-semibold">Status distribution</p>
        <div className="space-y-2.5">
          {STATUSES.map((s) => {
            const count = statusCounts[s] ?? 0;
            const pct   = total > 0 ? (count / total) * 100 : 0;
            const cfg   = STATUS_CONFIG[s];
            return (
              <div key={s} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                    <span>{cfg.label}</span>
                  </div>
                  <span className="font-medium tabular-nums">{count} ({Math.round(pct)}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full', cfg.dot)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* By project */}
      {byProject.length > 0 && (
        <div className="tc-card overflow-hidden">
          <div className="border-b border-border px-5 py-3">
            <p className="text-sm font-semibold">By project</p>
          </div>
          <div className="divide-y divide-border">
            {byProject.map((p) => {
              const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div key={p.name} className="flex items-center gap-4 px-5 py-3">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <p className="flex-1 min-w-0 text-sm truncate">{p.name}</p>
                  <div className="hidden sm:block w-24">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-20 text-right shrink-0">
                    {p.done}/{p.total} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="tc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">{total} task{total !== 1 ? 's' : ''}</p>
          <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CheckSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No tasks match the current filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {tasks.map((t) => {
              const sc  = STATUS_CONFIG[t.status];
              const pc  = PRIORITY_CONFIG[t.priority];
              const isOverdue = t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date();
              return (
                <div key={t.id} className="report-row flex items-center gap-3 px-5 py-3">
                  <Circle className={cn('h-3.5 w-3.5 shrink-0', sc?.dot.replace('bg-', 'text-') ?? 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    {t.project_name && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: t.project_color ?? '#94a3b8' }} />
                        <p className="text-xs text-muted-foreground">{t.project_name}</p>
                      </div>
                    )}
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0', sc?.color)}>
                    {sc?.label ?? t.status}
                  </span>
                  <span className={cn('text-xs font-medium shrink-0 hidden sm:block', pc?.color)}>
                    {pc?.label}
                  </span>
                  {t.due_date && (
                    <span className={cn('text-xs shrink-0 hidden md:block', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                      {fmtDate(t.due_date)}
                    </span>
                  )}
                  {t.assignee_name && (
                    <span className="text-xs text-muted-foreground shrink-0 hidden lg:block">{t.assignee_name}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
