'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MoreHorizontal, Check, Circle, Pencil, Trash2, Clock,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskStatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { cn } from '@/lib/utils';
import { updateTask, deleteTask } from '../actions';
import type { TaskRich } from '../_types';
import type { TaskStatus } from '@/lib/types';

type SortKey = 'title' | 'status' | 'priority' | 'due_date' | 'created_at';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { backlog: 0, todo: 1, in_progress: 2, in_review: 3, done: 4 };

interface Props {
  tasks: TaskRich[];
  onOpen: (task: TaskRich) => void;
  onEdit: (task: TaskRich) => void;
  onDeleted: (id: string) => void;
  onTaskUpdated: () => void;
}

export function TaskListView({ tasks, onOpen, onEdit, onDeleted, onTaskUpdated }: Props) {
  const [sort, setSort]     = useState<SortKey>('created_at');
  const [dir,  setDir]      = useState<SortDir>('desc');
  const [isPending, startTransition] = useTransition();

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setDir('asc'); }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sort === 'title')      cmp = a.title.localeCompare(b.title);
    if (sort === 'status')     cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (sort === 'priority')   cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    if (sort === 'due_date')   cmp = (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
    if (sort === 'created_at') cmp = a.created_at.localeCompare(b.created_at);
    return dir === 'asc' ? cmp : -cmp;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sort !== col) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />;
    return dir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  }

  function handleToggleDone(task: TaskRich) {
    const next: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    startTransition(async () => {
      const r = await updateTask(task.id, { status: next });
      if (r.error) toast.error(r.error);
      else onTaskUpdated();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteTask(id);
      if (r.error) toast.error(r.error);
      else { toast.success('Task deleted.'); onDeleted(id); }
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="tc-card">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Check className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No tasks found</p>
          <p className="mt-1 text-xs text-muted-foreground">Adjust your filters or create a new task.</p>
        </div>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="tc-card overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="w-5" />
        <button className="flex items-center gap-1 text-left hover:text-foreground transition-colors" onClick={() => toggleSort('title')}>
          Task <SortIcon col="title" />
        </button>
        <button className="hidden items-center gap-1 sm:flex hover:text-foreground transition-colors" onClick={() => toggleSort('priority')}>
          Priority <SortIcon col="priority" />
        </button>
        <button className="hidden items-center gap-1 md:flex hover:text-foreground transition-colors" onClick={() => toggleSort('status')}>
          Status <SortIcon col="status" />
        </button>
        <button className="hidden items-center gap-1 lg:flex hover:text-foreground transition-colors" onClick={() => toggleSort('due_date')}>
          Due <SortIcon col="due_date" />
        </button>
        <span className="hidden text-center lg:block">Assignee</span>
        <span className="w-8" />
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/50">
        {sorted.map((task) => {
          const overdue = task.due_date && new Date(task.due_date) < now && task.status !== 'done';
          return (
            <div
              key={task.id}
              className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggleDone(task)}
                disabled={isPending}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
              >
                {task.status === 'done'
                  ? <Check className="h-4 w-4 text-green-500" />
                  : <Circle className="h-4 w-4" />}
              </button>

              {/* Title + project */}
              <div className="min-w-0 cursor-pointer" onClick={() => onOpen(task)}>
                <p className={cn('truncate text-sm font-medium', task.status === 'done' && 'text-muted-foreground line-through')}>
                  {task.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {task.project_name && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.project_color ?? '#6366f1' }} />
                      {task.project_name}
                    </span>
                  )}
                  {task.labels.length > 0 && (
                    <div className="hidden items-center gap-1 sm:flex">
                      {task.labels.slice(0, 2).map((l) => (
                        <span key={l.id} className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ background: l.color }}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {task.subtask_count > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {task.done_subtask_count}/{task.subtask_count} subtasks
                    </span>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div className="hidden sm:block">
                <PriorityBadge priority={task.priority} />
              </div>

              {/* Status */}
              <div className="hidden md:block">
                <TaskStatusBadge status={task.status} />
              </div>

              {/* Due date */}
              <div className="hidden lg:block">
                {task.due_date ? (
                  <span className={cn('text-xs', overdue ? 'font-semibold text-red-500' : 'text-muted-foreground')}>
                    {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </div>

              {/* Assignee avatar */}
              <div className="hidden lg:flex items-center justify-center">
                {task.assignee_name ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary" title={task.assignee_name}>
                    {task.assignee_name[0].toUpperCase()}
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border border-dashed border-border" />
                )}
              </div>

              {/* Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" disabled={isPending}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onOpen(task)} className="cursor-pointer">
                    <Clock className="mr-2 h-3.5 w-3.5" />Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(task)} className="cursor-pointer">
                    <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(task.id)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
}
