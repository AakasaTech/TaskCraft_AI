'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskStatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import type { TaskStatus, TaskPriority } from '@/lib/types';

export interface DashTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project_name: string | null;
  project_color: string | null;
  is_overdue: boolean;
}

interface TasksWidgetProps {
  all: DashTask[];
  today: DashTask[];
  overdue: DashTask[];
}

const TABS = ['All', 'Due Today', 'Overdue'] as const;
type Tab = (typeof TABS)[number];

function formatDue(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7) return `${diffDays}d left`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TaskRow({ task }: { task: DashTask }) {
  return (
    <Link
      href={`/tasks`}
      className="group flex items-center gap-3 border-b border-border/50 px-5 py-3 transition-colors last:border-0 hover:bg-muted/40"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          {task.project_color && (
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: task.project_color }}
            />
          )}
          <span className="truncate text-sm font-medium group-hover:text-primary transition-colors">
            {task.title}
          </span>
        </div>
        {task.project_name && (
          <span className="text-xs text-muted-foreground">{task.project_name}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <PriorityBadge priority={task.priority} iconOnly />
        <TaskStatusBadge status={task.status} />
        {task.due_date && (
          <span
            className={cn(
              'text-xs font-medium',
              task.is_overdue ? 'text-red-500' : 'text-muted-foreground',
            )}
          >
            {formatDue(task.due_date)}
          </span>
        )}
      </div>
    </Link>
  );
}

export function TasksWidget({ all, today, overdue }: TasksWidgetProps) {
  const [tab, setTab] = useState<Tab>('All');

  const lists: Record<Tab, DashTask[]> = { All: all, 'Due Today': today, Overdue: overdue };
  const tasks = lists[tab];

  return (
    <div className="tc-card">
      {/* Header + tabs */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">My Tasks</h2>
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-1 border-b border-border/50 px-5 pt-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'relative pb-2 text-xs font-medium transition-colors',
              tab === t
                ? 'text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
            {t === 'Overdue' && overdue.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {overdue.length}
              </span>
            )}
            {t === 'Due Today' && today.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {today.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {tab === 'Overdue' ? 'No overdue tasks' : tab === 'Due Today' ? 'Nothing due today' : 'No open tasks'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tab === 'All' ? 'Create a task to get started.' : 'Great work — you\'re all caught up!'}
          </p>
        </div>
      ) : (
        <div>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
