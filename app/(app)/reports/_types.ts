export type ReportType =
  | 'project-progress'
  | 'task-completion'
  | 'time-tracking'
  | 'billable-hours'
  | 'client-profitability'
  | 'overdue-tasks'
  | 'team-workload'
  | 'team-productivity'
  | 'invoice-ready';

export interface ReportTimeEntry {
  id: string;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  client_id: string | null;
  client_name: string | null;
  task_id: string | null;
  task_title: string | null;
  user_id: string;
  user_name: string | null;
  description: string | null;
  start_time: string;
  duration_minutes: number | null;
  billable: boolean;
  hourly_rate: number | null;
  invoice_status: 'not_invoiced' | 'pending' | 'invoiced';
}

export interface ReportProject {
  id: string;
  name: string;
  color: string;
  status: string;
  client_id: string | null;
  client_name: string | null;
  due_date: string | null;
  budget: number | null;
  hourly_rate: number | null;
  billable: boolean;
  task_total: number;
  task_done: number;
  hours_logged: number;
}

export interface ReportTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  created_at: string;
  completed_at: string | null;
}

export interface ReportMember {
  user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  clientId: string;
  projectId: string;
  userId: string;
  status: string;
  billable: 'all' | 'billable' | 'non-billable';
}

export interface ReportProps {
  entries:  ReportTimeEntry[];
  projects: ReportProject[];
  tasks:    ReportTask[];
  members:  ReportMember[];
  filters:  FilterState;
  isTeamPlan:    boolean;
  currentUserId: string;
}
