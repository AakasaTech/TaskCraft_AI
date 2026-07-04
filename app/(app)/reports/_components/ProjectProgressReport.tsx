'use client';

import { useMemo } from 'react';
import { FolderKanban, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportProps } from '../_types';
import { fmtDate, fmtMins, fmtMoney, generateCSV, downloadCSV } from '../_utils';

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  active:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  on_hold:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  completed:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  archived:    'bg-muted text-muted-foreground',
};
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not started', active: 'Active', on_hold: 'On hold',
  completed: 'Completed', archived: 'Archived',
};

export function ProjectProgressReport({ projects }: ReportProps) {
  const sorted = useMemo(() =>
    [...projects].sort((a, b) => {
      const pctA = a.task_total > 0 ? a.task_done / a.task_total : 0;
      const pctB = b.task_total > 0 ? b.task_done / b.task_total : 0;
      return pctB - pctA;
    }),
  [projects]);

  const totals = useMemo(() => ({
    projects:  sorted.length,
    tasks:     sorted.reduce((s, p) => s + p.task_total, 0),
    done:      sorted.reduce((s, p) => s + p.task_done, 0),
    hours:     sorted.reduce((s, p) => s + p.hours_logged, 0),
    completed: sorted.filter(p => p.status === 'completed').length,
  }), [sorted]);

  function handleExport() {
    const csv = generateCSV(
      ['Project', 'Client', 'Status', 'Tasks Done', 'Tasks Total', 'Completion %', 'Hours Logged', 'Budget', 'Due Date'],
      sorted.map(p => [
        p.name, p.client_name ?? '', STATUS_LABELS[p.status] ?? p.status,
        p.task_done, p.task_total,
        p.task_total > 0 ? Math.round((p.task_done / p.task_total) * 100) : 0,
        (p.hours_logged / 60).toFixed(1), p.budget ?? '', fmtDate(p.due_date),
      ]),
    );
    downloadCSV(csv, 'project-progress');
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total projects', value: totals.projects },
          { label: 'Completed',      value: totals.completed },
          { label: 'Tasks done',     value: `${totals.done} / ${totals.tasks}` },
          { label: 'Hours logged',   value: fmtMins(totals.hours) },
        ].map(({ label, value }) => (
          <div key={label} className="tc-card px-4 py-4 text-center">
            <p className="text-xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="tc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">{sorted.length} project{sorted.length !== 1 ? 's' : ''}</p>
          <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No projects match the current filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((p) => {
              const pct = p.task_total > 0 ? Math.round((p.task_done / p.task_total) * 100) : 0;
              const isOverdue = p.due_date && p.status !== 'completed' && new Date(p.due_date) < new Date();
              return (
                <div key={p.id} className="report-row px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ background: p.color }} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        {p.client_name && (
                          <p className="text-xs text-muted-foreground">{p.client_name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[p.status] ?? 'bg-muted text-muted-foreground')}>
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                      {p.due_date && (
                        <span className={cn('text-xs', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                          {isOverdue ? 'Overdue ' : ''}{fmtDate(p.due_date)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress bar */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{p.task_done} / {p.task_total} tasks</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : 'bg-primary')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Right stats */}
                    <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      <span>{fmtMins(p.hours_logged)} logged</span>
                      {p.budget && <span>Budget: {fmtMoney(p.budget)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
