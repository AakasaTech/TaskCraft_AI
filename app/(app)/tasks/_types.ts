import type { TaskStatus, TaskPriority } from '@/lib/types';

export interface TaskRich {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  billable: boolean;
  hourly_rate: number | null;
  position: number;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  parent_task_id: string | null;
  labels: LabelChip[];
  subtask_count: number;
  done_subtask_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface LabelChip {
  id: string;
  name: string;
  color: string;
}

export interface TaskMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
}

export interface TaskProject {
  id: string;
  name: string;
  color: string;
}

export interface TaskFiltersState {
  search: string;
  project_id: string;
  assignee_id: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  due: 'today' | 'week' | 'overdue' | '';
  label_id: string;
}

export type TaskView = 'list' | 'kanban' | 'my-tasks' | 'overdue' | 'completed';
