import { cn } from '@/lib/utils';
import type { TaskStatus, ProjectStatus } from '@/lib/types';

interface TaskStatusBadgeProps  { status: TaskStatus }
interface ProjectStatusBadgeProps { status: ProjectStatus }

const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  backlog:     'status-backlog',
  todo:        'status-todo',
  in_progress: 'status-in-progress',
  in_review:   'status-in-review',
  done:        'status-done',
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog:     'Backlog',
  todo:        'To Do',
  in_progress: 'In Progress',
  in_review:   'Review',
  done:        'Done',
};

const PROJECT_STATUS_CLASS: Record<ProjectStatus, string> = {
  not_started: 'status-not-started',
  active:      'status-in-progress',
  on_hold:     'status-on-hold',
  completed:   'status-completed',
  archived:    'status-archived',
};

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  not_started: 'Not Started',
  active:      'In Progress',
  on_hold:     'On Hold',
  completed:   'Completed',
  archived:    'Archived',
};

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  return <span className={cn(TASK_STATUS_CLASS[status])}>{TASK_STATUS_LABEL[status]}</span>;
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  return <span className={cn(PROJECT_STATUS_CLASS[status])}>{PROJECT_STATUS_LABEL[status]}</span>;
}
