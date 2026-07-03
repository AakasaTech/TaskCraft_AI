'use client';
import { Calendar, Clock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PriorityBadge } from './PriorityBadge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Task } from '@/lib/types';

interface KanbanCardProps {
  task: Task & { project_name?: string };
  onTimerStart?: (taskId: string) => void;
}

export function KanbanCard({ task, onTimerStart }: KanbanCardProps) {
  const dueDate = task.due_date
    ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div className={cn('kanban-card', `priority-${task.priority}`)}>
      {/* Tags row */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5 pl-3">
        <PriorityBadge priority={task.priority} iconOnly />
        {task.project_name && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {task.project_name}
          </span>
        )}
      </div>

      {/* Title */}
      <p className="mb-3 pl-3 text-sm font-medium leading-snug line-clamp-2">{task.title}</p>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pl-3">
        <div className="flex items-center gap-2">
          {dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-[10px] font-medium',
                isOverdue ? 'text-red-500' : 'text-muted-foreground',
              )}
            >
              <Calendar className="h-3 w-3" />
              {dueDate}
            </span>
          )}
          {(task.estimated_hours ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {task.estimated_hours}h est.
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onTimerStart && task.status !== 'done' && (
            <button
              onClick={() => onTimerStart(task.id)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              title="Start timer"
            >
              <Play className="h-3 w-3" />
            </button>
          )}
          {task.assignee_id && (
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[8px]">U</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}
