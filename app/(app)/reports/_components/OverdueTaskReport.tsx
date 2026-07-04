'use client';

import { useMemo } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportProps, ReportTask } from '../_types';
import { fmtDate, daysOverdue, generateCSV, downloadCSV } from '../_utils';

const PRIORITY_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  low:    { label: 'Low',    color: 'text-green-600',  badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'   },
  medium: { label: 'Medium', color: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  high:   { label: 'High',   color: 'text-orange-600', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  urgent: { label: 'Urgent', color: 'text-red-600',    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'             },
};

interface Props extends ReportProps {
  allTasks: ReportTask[];
}

export function OverdueTaskReport({ allTasks, filters }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueTasks = useMemo(() => {
    return allTasks
      .filter((t) => {
        if (!t.due_date) return false;
        if (t.status === 'done') return false;
        if (new Date(t.due_date) >= today) return false;
        if (filters.projectId && t.project_id !== filters.projectId) return false;
        if (filters.userId    && t.assignee_id !== filters.userId)   return false;
        return true;
      })
      .map((t) => ({ ...t, daysLate: daysOverdue(t.due_date!) }))
      .sort((a, b) => b.daysLate - a.daysLate);
  }, [allTasks, filters, today]);

  const byPriority = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of overdueTasks) counts[t.priority] = (counts[t.priority] ?? 0) + 1;
    return counts;
  }, [overdueTasks]);

  function handleExport() {
    const csv = generateCSV(
      ['Task', 'Project', 'Assignee', 'Due Date', 'Days Overdue', 'Priority', 'Status'],
      overdueTasks.map(t => [
        t.title, t.project_name ?? '', t.assignee_name ?? '',
        fmtDate(t.due_date), t.daysLate,
        PRIORITY_CONFIG[t.priority]?.label ?? t.priority, t.status,
      ]),
    );
    downloadCSV(csv, 'overdue-tasks');
  }

  const critical = overdueTasks.filter(t => t.daysLate > 14).length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Overdue tasks',     value: overdueTasks.length },
          { label: 'Critical (>14d)',   value: critical },
          { label: 'Urgent priority',   value: byPriority.urgent  ?? 0 },
          { label: 'High priority',     value: byPriority.high    ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className={cn('tc-card px-4 py-4 text-center', label === 'Critical (>14d)' && critical > 0 ? 'border-destructive/40' : '')}>
            <p className={cn('text-xl font-bold tabular-nums', label === 'Overdue tasks' && overdueTasks.length > 0 ? 'text-destructive' : '')}>{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Task list */}
      <div className="tc-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">{overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''}</p>
          {overdueTasks.length > 0 && (
            <button onClick={handleExport} className="tc-btn-secondary gap-1.5 text-xs px-3 py-1.5 print:hidden">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          )}
        </div>

        {overdueTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
              <AlertTriangle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium text-sm">No overdue tasks</p>
            <p className="text-xs text-muted-foreground mt-1">Everything is on track.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-4 px-5 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground font-medium">
              <span className="col-span-2">Task</span>
              <span>Project</span>
              <span className="text-center">Days late</span>
              <span className="text-right">Priority</span>
            </div>
            <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
              {overdueTasks.map((t) => {
                const pc = PRIORITY_CONFIG[t.priority];
                const severity = t.daysLate > 30 ? 'bg-red-50 dark:bg-red-950/20'
                  : t.daysLate > 14 ? 'bg-orange-50 dark:bg-orange-950/20'
                  : '';
                return (
                  <div key={t.id} className={cn('report-row grid grid-cols-5 gap-4 items-center px-5 py-3', severity)}>
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">Due {fmtDate(t.due_date)}</p>
                        {t.assignee_name && <p className="text-xs text-muted-foreground hidden sm:block">· {t.assignee_name}</p>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      {t.project_name && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: t.project_color ?? '#94a3b8' }} />
                          <p className="text-xs truncate">{t.project_name}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <span className={cn('text-sm font-bold tabular-nums', t.daysLate > 14 ? 'text-destructive' : 'text-orange-600')}>
                        {t.daysLate}d
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', pc?.badge ?? '')}>
                        {pc?.label ?? t.priority}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
