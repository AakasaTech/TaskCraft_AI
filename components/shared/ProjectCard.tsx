import Link from 'next/link';
import { Calendar, CheckSquare, Clock, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectStatusBadge } from './StatusBadge';
import type { Project } from '@/lib/types';

interface ProjectCardProps {
  project: Project & {
    task_count?: number;
    done_count?: number;
    hours_logged?: number;
  };
  colorClass?: string;
}

const PROJECT_COLORS = [
  'bg-primary',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-orange-500',
];

export function ProjectCard({ project, colorClass }: ProjectCardProps) {
  const total    = project.task_count ?? 0;
  const done     = project.done_count ?? 0;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const color    = colorClass ?? PROJECT_COLORS[project.id.charCodeAt(0) % PROJECT_COLORS.length];

  const dueDate = project.due_date
    ? new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="tc-card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 h-3 w-3 shrink-0 rounded-full', color)} />
        <div className="flex-1 min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="text-sm font-semibold hover:text-primary transition-colors leading-tight line-clamp-1"
          >
            {project.name}
          </Link>
          {project.description && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{project.description}</p>
          )}
        </div>
        <button className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{done}/{total} tasks</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', color)}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer meta */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {total > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {total}
            </span>
          )}
          {(project.hours_logged ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {project.hours_logged}h
            </span>
          )}
          {dueDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {dueDate}
            </span>
          )}
        </div>
        <ProjectStatusBadge status={(project.status as 'active' | 'archived' | 'completed') ?? 'active'} />
      </div>
    </div>
  );
}
