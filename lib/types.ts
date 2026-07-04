// ================================================================
//  TaskCraft AI — TypeScript Types
//  Generated from database schema. Edit here when schema changes.
// ================================================================


// ── Enum / Union types ───────────────────────────────────────────

export type Plan               = 'free' | 'solo' | 'team';

export type SubscriptionStatus = 'trialing' | 'active' | 'cancelled' | 'expired' | 'past_due';

export type UserRole           = 'owner' | 'admin' | 'member' | 'viewer';
export type ProjectMemberRole  = 'manager' | 'member' | 'viewer';

export type ProjectStatus      = 'not_started' | 'active' | 'on_hold' | 'completed' | 'archived';
export type TaskStatus         = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority       = 'low' | 'medium' | 'high' | 'urgent';

export type TimeEntrySource          = 'timer' | 'manual' | 'imported';
export type TimeEntryInvoiceStatus   = 'not_invoiced' | 'pending' | 'invoiced';

export type IntegrationType          = 'billcraft' | 'supportcraft' | 'custom';
export type InvoiceSyncStatus        = 'pending' | 'synced' | 'failed';
export type SupportTicketSyncStatus  = 'linked' | 'synced' | 'unlinked';


// ================================================================
// DATABASE ROW TYPES
// One interface per table. Field names match column names exactly.
// ================================================================

// ── profiles ─────────────────────────────────────────────────────
export interface Profile {
  id:              string;
  email:           string;
  full_name:       string | null;
  avatar_url:      string | null;
  timezone:        string;
  plan:            Plan;
  plan_expires_at: string | null;
  is_admin:        boolean;
  onboarded:       boolean;
  created_at:      string;
  updated_at:      string;
}

// ── plans ─────────────────────────────────────────────────────────
export interface PlanRecord {
  id:              string;  // 'free' | 'solo' | 'team'
  name:            string;
  price_monthly:   number;
  price_yearly:    number;
  max_workspaces:  number;  // -1 = unlimited
  max_projects:    number;
  max_members:     number;
  features:        PlanFeatures;
  created_at:      string;
}

export interface PlanFeatures {
  time_tracking:   boolean;
  billable_hours:  boolean;
  reports_days:    number;  // -1 = unlimited
  exports:         boolean;
  integrations:    boolean;
  team_management: boolean;
  admin_panel?:    boolean;
}

// ── subscriptions ─────────────────────────────────────────────────
export interface Subscription {
  id:                     string;
  user_id:                string;
  plan_id:                Plan;
  status:                 SubscriptionStatus;
  paypal_subscription_id: string | null;
  trial_ends_at:          string | null;
  current_period_start:   string | null;
  current_period_end:     string | null;
  cancelled_at:           string | null;
  created_at:             string;
  updated_at:             string;
}

// ── workspaces ───────────────────────────────────────────────────
export interface Workspace {
  id:          string;
  name:        string;
  slug:        string;
  description: string | null;
  avatar_url:  string | null;
  owner_id:    string;
  settings:    Record<string, unknown>;
  created_at:  string;
  updated_at:  string;
}

// ── workspace_members ─────────────────────────────────────────────
export interface WorkspaceMember {
  id:           string;
  workspace_id: string;
  user_id:      string;
  role:         UserRole;
  invited_by:   string | null;
  invited_at:   string | null;
  joined_at:    string | null;
  created_at:   string;
}

// ── clients ───────────────────────────────────────────────────────
export interface Client {
  id:                   string;
  workspace_id:         string;
  name:                 string;
  email:                string | null;
  billing_email:        string | null;
  phone:                string | null;
  company:              string | null;
  website:              string | null;
  address:              ClientAddress;
  notes:                string | null;
  default_hourly_rate:  number | null;
  currency:             string;
  created_by:           string | null;
  created_at:           string;
  updated_at:           string;
}

export interface ClientAddress {
  line1?:   string;
  line2?:   string;
  city?:    string;
  state?:   string;
  zip?:     string;
  country?: string;
}

// ── projects ──────────────────────────────────────────────────────
export interface Project {
  id:           string;
  workspace_id: string;
  client_id:    string | null;
  name:         string;
  description:  string | null;
  color:        string;
  status:       ProjectStatus;
  start_date:   string | null;
  due_date:     string | null;
  budget:       number | null;
  hourly_rate:  number | null;
  billable:     boolean;
  position:     number;
  created_by:   string | null;
  created_at:   string;
  updated_at:   string;
}

// ── project_members ───────────────────────────────────────────────
export interface ProjectMember {
  id:         string;
  project_id: string;
  user_id:    string;
  role:       ProjectMemberRole;
  created_at: string;
}

// ── task_labels ───────────────────────────────────────────────────
export interface TaskLabel {
  id:           string;
  workspace_id: string;
  name:         string;
  color:        string;
  created_by:   string | null;
  created_at:   string;
}

// ── tasks ─────────────────────────────────────────────────────────
export interface Task {
  id:              string;
  workspace_id:    string;
  project_id:      string | null;
  parent_task_id:  string | null;
  title:           string;
  description:     string | null;
  assignee_id:     string | null;
  created_by:      string;
  status:          TaskStatus;
  priority:        TaskPriority;
  start_date:      string | null;
  due_date:        string | null;
  completed_at:    string | null;
  estimated_hours: number | null;
  actual_hours:    number;   // maintained by trigger; sum of completed time entries
  billable:        boolean;
  hourly_rate:     number | null;
  position:        number;
  created_at:      string;
  updated_at:      string;
}

// ── task_label_assignments ────────────────────────────────────────
export interface TaskLabelAssignment {
  task_id:    string;
  label_id:   string;
  created_at: string;
}

// ── task_comments ─────────────────────────────────────────────────
export interface TaskComment {
  id:         string;
  task_id:    string;
  user_id:    string;
  content:    string;
  is_edited:  boolean;
  created_at: string;
  updated_at: string;
}

// ── task_attachments ──────────────────────────────────────────────
export interface TaskAttachment {
  id:         string;
  task_id:    string;
  user_id:    string;
  file_name:  string;
  file_url:   string;
  file_size:  number | null;  // bytes
  file_type:  string | null;  // MIME type
  created_at: string;
}

// ── task_activity ─────────────────────────────────────────────────
export interface TaskActivity {
  id:         string;
  task_id:    string;
  user_id:    string | null;
  action:     TaskActivityAction;
  field_name: string | null;
  old_value:  unknown;
  new_value:  unknown;
  created_at: string;
}

export type TaskActivityAction =
  | 'created'
  | 'status_changed'
  | 'priority_changed'
  | 'assignee_changed'
  | 'due_date_changed'
  | 'title_changed'
  | 'comment_added'
  | 'attachment_added'
  | 'label_added'
  | 'label_removed'
  | string;  // extensible

// ── time_entries ──────────────────────────────────────────────────
export interface TimeEntry {
  id:               string;
  workspace_id:     string;
  task_id:          string | null;
  project_id:       string | null;
  user_id:          string;
  description:      string | null;
  start_time:       string;           // ISO 8601 timestamptz
  end_time:         string | null;    // null = timer running
  duration_minutes: number | null;    // computed by trigger when end_time is set
  billable:         boolean;
  hourly_rate:      number | null;
  invoice_status:   TimeEntryInvoiceStatus;
  source:           TimeEntrySource;
  created_at:       string;
  updated_at:       string;
}

// ── invoices_sync ─────────────────────────────────────────────────
export interface InvoiceSync {
  id:                   string;
  workspace_id:         string;
  project_id:           string | null;
  client_id:            string | null;
  user_id:              string;
  billcraft_invoice_id: string;
  total_hours:          number | null;
  total_amount:         number | null;
  currency:             string;
  status:               InvoiceSyncStatus;
  synced_at:            string | null;
  created_at:           string;
}

// ── support_ticket_links ──────────────────────────────────────────
export interface SupportTicketLink {
  id:                     string;
  workspace_id:           string;
  task_id:                string;
  supportcraft_ticket_id: string;
  ticket_title:           string | null;
  ticket_url:             string | null;
  sync_status:            SupportTicketSyncStatus;
  created_by:             string | null;
  created_at:             string;
  updated_at:             string;
}

// ── notifications ─────────────────────────────────────────────────
export interface Notification {
  id:           string;
  user_id:      string;
  workspace_id: string | null;
  type:         NotificationType;
  title:        string;
  body:         string | null;
  metadata:     Record<string, unknown>;
  read_at:      string | null;  // null = unread
  created_at:   string;
}

export type NotificationType =
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'comment_added'
  | 'member_invited'
  | 'billing_update'
  | 'invoice_synced'
  | 'ticket_linked'
  | string;

// ── integration_settings ──────────────────────────────────────────
export interface IntegrationSetting {
  id:               string;
  workspace_id:     string;
  integration_type: IntegrationType;
  enabled:          boolean;
  config:           Record<string, unknown>;
  created_by:       string | null;
  created_at:       string;
  updated_at:       string;
}

// ── audit_logs ───────────────────────────────────────────────────
export interface AuditLog {
  id:            string;
  workspace_id:  string | null;
  user_id:       string | null;
  action:        string;
  resource_type: string;
  resource_id:   string | null;
  old_data:      unknown;
  new_data:      unknown;
  ip_address:    string | null;
  user_agent:    string | null;
  created_at:    string;
}


// ================================================================
// ENRICHED / JOINED TYPES
// Used in queries that SELECT across multiple tables.
// ================================================================

export interface TaskWithRelations extends Task {
  project?:  Pick<Project, 'id' | 'name' | 'color'> | null;
  assignee?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
  labels?:   TaskLabel[];
  subtasks?: Task[];
}

export interface ProjectWithStats extends Project {
  task_count?:   number;
  done_count?:   number;
  hours_logged?: number;
  client?:       Pick<Client, 'id' | 'name' | 'company'> | null;
}

export interface TimeEntryWithRelations extends TimeEntry {
  task?:    Pick<Task, 'id' | 'title'> | null;
  project?: Pick<Project, 'id' | 'name' | 'color'> | null;
}

export interface WorkspaceMemberWithProfile extends WorkspaceMember {
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'email'> | null;
}

export interface TaskCommentWithProfile extends TaskComment {
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}

export interface TaskActivityWithProfile extends TaskActivity {
  profile?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null;
}


// ================================================================
// INPUT TYPES  (for create / update API calls)
// ================================================================

export interface CreateWorkspaceInput {
  name:        string;
  description?: string;
}

export interface CreateProjectInput {
  name:         string;
  description?: string;
  client_id?:   string;
  color?:       string;
  status?:      ProjectStatus;
  start_date?:  string;
  due_date?:    string;
  budget?:      number;
  hourly_rate?: number;
  billable?:    boolean;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  status?: ProjectStatus;
}

export interface CreateTaskInput {
  title:            string;
  description?:     string;
  project_id?:      string;
  parent_task_id?:  string;
  assignee_id?:     string;
  status?:          TaskStatus;
  priority?:        TaskPriority;
  start_date?:      string;
  due_date?:        string;
  estimated_hours?: number;
  billable?:        boolean;
  hourly_rate?:     number;
  label_ids?:       string[];
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?:   TaskStatus;
  priority?: TaskPriority;
  position?: number;
}

export interface CreateTimeEntryInput {
  task_id?:         string;
  project_id?:      string;
  description?:     string;
  start_time:       string;
  end_time?:        string;
  duration_minutes?: number;
  billable?:        boolean;
  hourly_rate?:     number;
  source?:          TimeEntrySource;
}

export interface CreateClientInput {
  name:                 string;
  email?:               string;
  billing_email?:       string;
  phone?:               string;
  company?:             string;
  website?:             string;
  address?:             Partial<ClientAddress>;
  notes?:               string;
  default_hourly_rate?: number | null;
  currency?:            string;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {}
