export interface TimeEntryRich {
  id: string;
  workspace_id: string;
  task_id: string | null;
  project_id: string | null;
  user_id: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  billable: boolean;
  hourly_rate: number | null;
  invoice_status: 'not_invoiced' | 'pending' | 'invoiced';
  source: 'timer' | 'manual' | 'imported';
  created_at: string;
  // enriched
  task_title: string | null;
  project_name: string | null;
  project_color: string | null;
  client_name: string | null;
}

export interface RunningTimer {
  id: string;
  description: string | null;
  start_time: string;
  task_id: string | null;
  task_title: string | null;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
  billable: boolean;
  hourly_rate: number | null;
}

export interface TimeProject {
  id: string;
  name: string;
  color: string | null;
  client_name: string | null;
  hourly_rate: number | null;
}

export interface TimeTask {
  id: string;
  title: string;
  project_id: string | null;
}
