'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskStatusBadge } from '@/components/shared/StatusBadge';
import type { TaskStatus, TaskPriority } from '@/lib/types';

export interface CalendarTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  project_name: string | null;
  project_color: string | null;
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low:    'bg-slate-400',
  medium: 'bg-sky-400',
  high:   'bg-orange-400',
  urgent: 'bg-red-500',
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarClient({ tasks }: { tasks: CalendarTask[] }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<CalendarTask | null>(null);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  // Build grid
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function tasksForDay(day: number): CalendarTask[] {
    const d = new Date(year, month, day);
    return tasks.filter((t) => isSameDay(new Date(t.due_date), d));
  }

  const monthLabel = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="min-w-[180px] text-center text-base font-semibold">{monthLabel}</h2>
        <button onClick={nextMonth} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
          className="ml-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          Today
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
          {tasks.filter((t) => {
            const d = new Date(t.due_date);
            return d.getFullYear() === year && d.getMonth() === month;
          }).length} tasks this month
        </div>
      </div>

      {/* Calendar grid */}
      <div className="tc-card overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border">
          {DOW.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/50">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="h-28 bg-muted/20" />;
            }

            const dayTasks = tasksForDay(day);
            const isToday  = isSameDay(new Date(year, month, day), today);
            const isPast   = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

            return (
              <div
                key={day}
                className={cn(
                  'h-28 overflow-hidden p-1.5 transition-colors',
                  isPast && !isToday && 'bg-muted/20',
                )}
              >
                {/* Day number */}
                <div className={cn(
                  'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  isToday ? 'bg-primary text-white' : 'text-foreground',
                )}>
                  {day}
                </div>

                {/* Task chips */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className={cn(
                        'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] font-medium transition-colors hover:opacity-80',
                        t.status === 'done'
                          ? 'bg-muted text-muted-foreground line-through'
                          : 'bg-primary/10 text-primary',
                      )}
                      style={t.project_color && t.status !== 'done'
                        ? { background: t.project_color + '22', color: t.project_color }
                        : undefined}
                    >
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_DOT[t.priority])} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="pl-1 text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task mini-detail on click */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', PRIORITY_DOT[selected.priority])} />
                <div>
                  <p className="text-sm font-semibold">{selected.title}</p>
                  {selected.project_name && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: selected.project_color ?? '#6366f1' }} />
                      {selected.project_name}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                ×
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <TaskStatusBadge status={selected.status} />
              <p className="text-xs text-muted-foreground">
                Due {new Date(selected.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
