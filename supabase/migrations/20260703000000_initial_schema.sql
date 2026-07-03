-- ================================================================
--  T A S K C R A F T   A I  –  D A T A B A S E   S C H E M A
--  Migration 001: Initial Schema
--
--  Multi-tenant model: every resource is scoped to a workspace.
--  Isolation is enforced through RLS policies that call SECURITY
--  DEFINER helper functions to avoid recursive policy evaluation.
-- ================================================================


-- ================================================================
-- PART 1 — EXTENSIONS
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fuzzy text search indexes


-- ================================================================
-- PART 2 — TABLES  (in FK dependency order)
-- ================================================================

-- ── profiles ─────────────────────────────────────────────────────
-- One row per auth.users entry; plan is denormalised from subscriptions
-- for fast plan-gate checks without joins.
CREATE TABLE IF NOT EXISTS profiles (
  id               uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text        NOT NULL,
  full_name        text,
  avatar_url       text,
  timezone         text        NOT NULL DEFAULT 'UTC',
  plan             text        NOT NULL DEFAULT 'free'
                               CHECK (plan IN ('free','solo','team')),
  plan_expires_at  timestamptz,
  is_admin         boolean     NOT NULL DEFAULT false,
  onboarded        boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── plans ─────────────────────────────────────────────────────────
-- Static plan definitions; seeded below.  max = -1 means unlimited.
CREATE TABLE IF NOT EXISTS plans (
  id               text        PRIMARY KEY,  -- 'free' | 'solo' | 'team'
  name             text        NOT NULL,
  price_monthly    numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly     numeric(10,2) NOT NULL DEFAULT 0,
  max_workspaces   integer     NOT NULL DEFAULT 1,
  max_projects     integer     NOT NULL DEFAULT 3,
  max_members      integer     NOT NULL DEFAULT 1,
  features         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── subscriptions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id                  text        NOT NULL REFERENCES plans(id),
  status                   text        NOT NULL DEFAULT 'active'
                                       CHECK (status IN ('trialing','active','cancelled','expired','past_due')),
  paypal_subscription_id   text        UNIQUE,
  trial_ends_at            timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- ── workspaces ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  slug         text        NOT NULL UNIQUE,
  description  text,
  avatar_url   text,
  owner_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  settings     jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── workspace_members ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('owner','admin','member','viewer')),
  invited_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at   timestamptz,
  joined_at    timestamptz DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- ================================================================
-- PART 3 — RLS HELPER FUNCTIONS
-- Defined here, after workspace_members exists, because LANGUAGE sql
-- functions resolve table references at creation time (unlike plpgsql).
-- SECURITY DEFINER means the function body runs as the postgres role,
-- bypassing RLS on workspace_members — this prevents the infinite
-- recursion that would otherwise occur when workspace_members policies
-- call a function that itself queries workspace_members.
-- ================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id      = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id      = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

-- ── clients ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  email        text,
  phone        text,
  company      text,
  website      text,
  address      jsonb       NOT NULL DEFAULT '{}',
  notes        text,
  created_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── projects ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id    uuid        REFERENCES clients(id)  ON DELETE SET NULL,
  name         text        NOT NULL,
  description  text,
  color        text        NOT NULL DEFAULT '#6366f1',
  status       text        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','on_hold','completed','archived')),
  start_date   date,
  due_date     date,
  budget       numeric(12,2),
  hourly_rate  numeric(10,2),
  billable     boolean     NOT NULL DEFAULT true,
  position     integer     NOT NULL DEFAULT 0,
  created_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── project_members ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'member'
                           CHECK (role IN ('manager','member','viewer')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- ── task_labels ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_labels (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  color        text        NOT NULL DEFAULT '#6366f1',
  created_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

-- ── tasks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  project_id       uuid        REFERENCES projects(id)             ON DELETE SET NULL,
  parent_task_id   uuid        REFERENCES tasks(id)                ON DELETE SET NULL,
  title            text        NOT NULL,
  description      text,
  assignee_id      uuid        REFERENCES profiles(id)             ON DELETE SET NULL,
  created_by       uuid        NOT NULL REFERENCES profiles(id),
  status           text        NOT NULL DEFAULT 'todo'
                               CHECK (status   IN ('todo','in_progress','in_review','done')),
  priority         text        NOT NULL DEFAULT 'medium'
                               CHECK (priority IN ('low','medium','high','urgent')),
  start_date       date,
  due_date         date,
  completed_at     timestamptz,
  estimated_hours  numeric(6,2),
  actual_hours     numeric(6,2) NOT NULL DEFAULT 0,
  billable         boolean     NOT NULL DEFAULT false,
  hourly_rate      numeric(10,2),
  position         integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── task_label_assignments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_label_assignments (
  task_id     uuid        NOT NULL REFERENCES tasks(id)       ON DELETE CASCADE,
  label_id    uuid        NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, label_id)
);

-- ── task_comments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid        NOT NULL REFERENCES tasks(id)    ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id),
  content     text        NOT NULL,
  is_edited   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── task_attachments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid        NOT NULL REFERENCES tasks(id)    ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id),
  file_name   text        NOT NULL,
  file_url    text        NOT NULL,
  file_size   integer,             -- bytes
  file_type   text,                -- MIME type
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── task_activity ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_activity (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid        NOT NULL REFERENCES tasks(id)    ON DELETE CASCADE,
  user_id     uuid        REFERENCES profiles(id)          ON DELETE SET NULL,
  action      text        NOT NULL,
  field_name  text,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── time_entries ──────────────────────────────────────────────────
-- end_time NULL = timer currently running.
-- duration_minutes is computed by trigger when end_time is set,
-- but can also be set directly for manual entries.
CREATE TABLE IF NOT EXISTS time_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id          uuid        REFERENCES tasks(id)    ON DELETE SET NULL,
  project_id       uuid        REFERENCES projects(id) ON DELETE SET NULL,
  user_id          uuid        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  description      text,
  start_time       timestamptz NOT NULL,
  end_time         timestamptz,
  duration_minutes integer,
  billable         boolean     NOT NULL DEFAULT false,
  hourly_rate      numeric(10,2),
  invoice_status   text        NOT NULL DEFAULT 'not_invoiced'
                               CHECK (invoice_status IN ('not_invoiced','pending','invoiced')),
  source           text        NOT NULL DEFAULT 'timer'
                               CHECK (source IN ('timer','manual','imported')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_end_after_start CHECK (end_time IS NULL OR end_time > start_time)
);

-- ── invoices_sync ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices_sync (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id           uuid        REFERENCES projects(id) ON DELETE SET NULL,
  client_id            uuid        REFERENCES clients(id)  ON DELETE SET NULL,
  user_id              uuid        NOT NULL REFERENCES profiles(id),
  billcraft_invoice_id text        NOT NULL,
  total_hours          numeric(8,2),
  total_amount         numeric(12,2),
  currency             text        NOT NULL DEFAULT 'USD',
  status               text        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','synced','failed')),
  synced_at            timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── support_ticket_links ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_ticket_links (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id                 uuid        NOT NULL REFERENCES tasks(id)      ON DELETE CASCADE,
  supportcraft_ticket_id  text        NOT NULL,
  ticket_title            text,
  ticket_url              text,
  sync_status             text        NOT NULL DEFAULT 'linked'
                                      CHECK (sync_status IN ('linked','synced','unlinked')),
  created_by              uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, supportcraft_ticket_id)
);

-- ── notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  workspace_id uuid        REFERENCES workspaces(id)          ON DELETE CASCADE,
  type         text        NOT NULL,  -- 'task_assigned' | 'task_due' | 'comment_added' | ...
  title        text        NOT NULL,
  body         text,
  metadata     jsonb       NOT NULL DEFAULT '{}',
  read_at      timestamptz,           -- NULL = unread
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── integration_settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_settings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration_type text        NOT NULL
                               CHECK (integration_type IN ('billcraft','supportcraft','custom')),
  enabled          boolean     NOT NULL DEFAULT false,
  config           jsonb       NOT NULL DEFAULT '{}',
  created_by       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, integration_type)
);

-- ── audit_logs ───────────────────────────────────────────────────
-- Append-only; written by service_role or SECURITY DEFINER functions only.
CREATE TABLE IF NOT EXISTS audit_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id        uuid        REFERENCES profiles(id)   ON DELETE SET NULL,
  action         text        NOT NULL,
  resource_type  text        NOT NULL,
  resource_id    uuid,
  old_data       jsonb,
  new_data       jsonb,
  ip_address     inet,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);


-- ================================================================
-- PART 4 — INDEXES
-- ================================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email   ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_plan    ON profiles(plan);

-- subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status  ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paypal
  ON subscriptions(paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;

-- workspaces
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- workspace_members (heavily used in RLS helper functions)
CREATE INDEX IF NOT EXISTS idx_wm_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user_id      ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_role         ON workspace_members(workspace_id, role);

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm    ON clients USING gin(name gin_trgm_ops);

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id
  ON projects(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_status    ON projects(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_position  ON projects(workspace_id, position);
CREATE INDEX IF NOT EXISTS idx_projects_due_date
  ON projects(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING gin(name gin_trgm_ops);

-- project_members
CREATE INDEX IF NOT EXISTS idx_pm_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user_id    ON project_members(user_id);

-- task_labels
CREATE INDEX IF NOT EXISTS idx_task_labels_workspace_id ON task_labels(workspace_id);

-- tasks  (most queried table — index every major filter/sort axis)
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id  ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id
  ON tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id
  ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by    ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status        ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority      ON tasks(workspace_id, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id
  ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_position      ON tasks(project_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
  ON tasks(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm    ON tasks USING gin(title gin_trgm_ops);

-- task_label_assignments
CREATE INDEX IF NOT EXISTS idx_tla_label_id ON task_label_assignments(label_id);

-- task_comments
CREATE INDEX IF NOT EXISTS idx_tc_task_id    ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_tc_user_id    ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_tc_created_at ON task_comments(task_id, created_at);

-- task_attachments
CREATE INDEX IF NOT EXISTS idx_ta_task_id ON task_attachments(task_id);

-- task_activity
CREATE INDEX IF NOT EXISTS idx_tact_task_id    ON task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_tact_user_id    ON task_activity(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tact_created_at ON task_activity(task_id, created_at DESC);

-- time_entries
CREATE INDEX IF NOT EXISTS idx_te_workspace_id ON time_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_te_user_id      ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_te_task_id
  ON time_entries(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_te_project_id
  ON time_entries(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_te_start_time   ON time_entries(user_id, start_time DESC);
-- Partial index for "active timers" — only rows where end_time is still null
CREATE INDEX IF NOT EXISTS idx_te_running
  ON time_entries(user_id) WHERE end_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_te_invoice_status
  ON time_entries(workspace_id, invoice_status) WHERE invoice_status != 'invoiced';

-- invoices_sync
CREATE INDEX IF NOT EXISTS idx_inv_workspace_id ON invoices_sync(workspace_id);
CREATE INDEX IF NOT EXISTS idx_inv_project_id
  ON invoices_sync(project_id) WHERE project_id IS NOT NULL;

-- support_ticket_links
CREATE INDEX IF NOT EXISTS idx_stl_task_id      ON support_ticket_links(task_id);
CREATE INDEX IF NOT EXISTS idx_stl_workspace_id ON support_ticket_links(workspace_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notif_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_workspace
  ON notifications(workspace_id) WHERE workspace_id IS NOT NULL;
-- Partial index so "unread count" queries never need a full scan
CREATE INDEX IF NOT EXISTS idx_notif_unread
  ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notif_created_at ON notifications(user_id, created_at DESC);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_workspace
  ON audit_logs(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_user
  ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_resource   ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);


-- ================================================================
-- PART 5 — TRIGGER FUNCTIONS
-- ================================================================

-- ── Generic updated_at stamp ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── New user → profile + default workspace ────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  display_name     text;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    display_name,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO workspaces (name, owner_id, slug)
  VALUES (
    display_name || '''s Workspace',
    NEW.id,
    'ws-' || encode(gen_random_bytes(8), 'hex')
  )
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Compute duration_minutes when timer is stopped ─────────────────
CREATE OR REPLACE FUNCTION compute_duration()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- On UPDATE: end_time just became non-null
  IF TG_OP = 'UPDATE' AND NEW.end_time IS NOT NULL AND (OLD.end_time IS NULL OR OLD.end_time != NEW.end_time) THEN
    NEW.duration_minutes :=
      GREATEST(0, EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::integer / 60);
  END IF;
  -- On INSERT: both times already set (manual entry)
  IF TG_OP = 'INSERT' AND NEW.end_time IS NOT NULL AND NEW.duration_minutes IS NULL THEN
    NEW.duration_minutes :=
      GREATEST(0, EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::integer / 60);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER time_entries_compute_duration
  BEFORE INSERT OR UPDATE OF end_time ON time_entries
  FOR EACH ROW EXECUTE FUNCTION compute_duration();

-- ── Roll up actual_hours on the parent task ───────────────────────
CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_task_id uuid;
BEGIN
  target_task_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.task_id ELSE NEW.task_id END,
    OLD.task_id
  );
  IF target_task_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE tasks
  SET actual_hours = COALESCE((
    SELECT SUM(duration_minutes) / 60.0
    FROM time_entries
    WHERE task_id   = target_task_id
      AND end_time IS NOT NULL
  ), 0)
  WHERE id = target_task_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER te_update_task_hours_insert
  AFTER INSERT ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_task_actual_hours();

CREATE OR REPLACE TRIGGER te_update_task_hours_update
  AFTER UPDATE OF end_time, duration_minutes, task_id ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_task_actual_hours();

CREATE OR REPLACE TRIGGER te_update_task_hours_delete
  AFTER DELETE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_task_actual_hours();

-- ── Set / clear completed_at on status change ─────────────────────
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' AND OLD.status = 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tasks_set_completed_at
  BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_task_completed_at();

-- ── Automatic task activity log ───────────────────────────────────
-- Logs creation + key field changes to task_activity for the audit trail.
CREATE OR REPLACE FUNCTION log_task_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO task_activity (task_id, user_id, action)
  VALUES (NEW.id, NEW.created_by, 'created');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tasks_log_created
  AFTER INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_created();

CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_activity (task_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status_changed',   'status',
            to_jsonb(OLD.status),    to_jsonb(NEW.status));
  END IF;

  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO task_activity (task_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority_changed', 'priority',
            to_jsonb(OLD.priority),  to_jsonb(NEW.priority));
  END IF;

  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO task_activity (task_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assignee_changed', 'assignee_id',
            to_jsonb(OLD.assignee_id), to_jsonb(NEW.assignee_id));
  END IF;

  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO task_activity (task_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'due_date_changed', 'due_date',
            to_jsonb(OLD.due_date),  to_jsonb(NEW.due_date));
  END IF;

  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO task_activity (task_id, user_id, action, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'title_changed', 'title',
            to_jsonb(OLD.title), to_jsonb(NEW.title));
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER tasks_log_changes
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_changes();

-- ── Sync active subscription → profile.plan ───────────────────────
CREATE OR REPLACE FUNCTION sync_subscription_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE profiles
    SET plan            = NEW.plan_id,
        plan_expires_at = NEW.current_period_end
    WHERE id = NEW.user_id;

  ELSIF NEW.status IN ('cancelled', 'expired') THEN
    -- Only downgrade if no other active subscription exists
    IF NOT EXISTS (
      SELECT 1 FROM subscriptions
      WHERE user_id = NEW.user_id
        AND status  = 'active'
        AND id     <> NEW.id
    ) THEN
      UPDATE profiles
      SET plan            = 'free',
          plan_expires_at = NULL
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER subscriptions_sync_to_profile
  AFTER INSERT OR UPDATE OF status, plan_id ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION sync_subscription_to_profile();

-- ── Apply updated_at to all mutable tables ────────────────────────
CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_support_links_updated_at
  BEFORE UPDATE ON support_ticket_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ================================================================
-- PART 6 — ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_labels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity         ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_sync         ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- ── profiles ─────────────────────────────────────────────────────
-- Users can see their own row AND profiles of people who share a workspace.
CREATE POLICY "profiles: view own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles: view co-workers"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT wm.user_id FROM workspace_members wm
      WHERE is_workspace_member(wm.workspace_id)
    )
  );

CREATE POLICY "profiles: update own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ── plans ─────────────────────────────────────────────────────────
CREATE POLICY "plans: public read"
  ON plans FOR SELECT
  USING (true);

-- ── subscriptions ─────────────────────────────────────────────────
CREATE POLICY "subscriptions: view own"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Webhooks write via service_role (bypasses RLS entirely).
-- No additional INSERT/UPDATE policies needed for authenticated users.

-- ── workspaces ───────────────────────────────────────────────────
CREATE POLICY "workspaces: members can read"
  ON workspaces FOR SELECT
  USING (is_workspace_member(id));

CREATE POLICY "workspaces: authenticated can create"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "workspaces: admins can update"
  ON workspaces FOR UPDATE
  USING (is_workspace_admin(id))
  WITH CHECK (is_workspace_admin(id));

CREATE POLICY "workspaces: owner can delete"
  ON workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- ── workspace_members ─────────────────────────────────────────────
-- is_workspace_member() is SECURITY DEFINER so no recursion here.
CREATE POLICY "workspace_members: members can read"
  ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_members: admins can invite"
  ON workspace_members FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "workspace_members: admins can update roles"
  ON workspace_members FOR UPDATE
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "workspace_members: admins can remove / self can leave"
  ON workspace_members FOR DELETE
  USING (is_workspace_admin(workspace_id) OR user_id = auth.uid());

-- ── clients ───────────────────────────────────────────────────────
CREATE POLICY "clients: members read"
  ON clients FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "clients: members create"
  ON clients FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "clients: members update"
  ON clients FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "clients: admins delete"
  ON clients FOR DELETE
  USING (is_workspace_admin(workspace_id));

-- ── projects ──────────────────────────────────────────────────────
CREATE POLICY "projects: members read"
  ON projects FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "projects: members create"
  ON projects FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "projects: members update"
  ON projects FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "projects: admins delete"
  ON projects FOR DELETE
  USING (is_workspace_admin(workspace_id));

-- ── project_members ───────────────────────────────────────────────
CREATE POLICY "project_members: workspace members read"
  ON project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
        AND is_workspace_member(p.workspace_id)
    )
  );

CREATE POLICY "project_members: workspace admins manage"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id
        AND is_workspace_admin(p.workspace_id)
    )
  );

-- ── task_labels ───────────────────────────────────────────────────
CREATE POLICY "task_labels: members read"
  ON task_labels FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "task_labels: members create"
  ON task_labels FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "task_labels: members update"
  ON task_labels FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "task_labels: admins delete"
  ON task_labels FOR DELETE
  USING (is_workspace_admin(workspace_id));

-- ── tasks ─────────────────────────────────────────────────────────
CREATE POLICY "tasks: members read"
  ON tasks FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "tasks: members create"
  ON tasks FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "tasks: members update"
  ON tasks FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "tasks: creator or admin delete"
  ON tasks FOR DELETE
  USING (created_by = auth.uid() OR is_workspace_admin(workspace_id));

-- ── task_label_assignments ────────────────────────────────────────
CREATE POLICY "task_label_assignments: members read"
  ON task_label_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
    )
  );

CREATE POLICY "task_label_assignments: members manage"
  ON task_label_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
    )
  );

-- ── task_comments ─────────────────────────────────────────────────
CREATE POLICY "task_comments: members read"
  ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
    )
  );

CREATE POLICY "task_comments: members create"
  ON task_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
    )
  );

CREATE POLICY "task_comments: author update"
  ON task_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "task_comments: author or admin delete"
  ON task_comments FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_admin(t.workspace_id)
    )
  );

-- ── task_attachments ──────────────────────────────────────────────
CREATE POLICY "task_attachments: members read"
  ON task_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
    )
  );

CREATE POLICY "task_attachments: members upload"
  ON task_attachments FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
    )
  );

CREATE POLICY "task_attachments: uploader or admin delete"
  ON task_attachments FOR DELETE
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_admin(t.workspace_id)
    )
  );

-- ── task_activity ─────────────────────────────────────────────────
-- Read-only for workspace members; rows are inserted only by SECURITY DEFINER triggers.
CREATE POLICY "task_activity: members read"
  ON task_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id AND is_workspace_member(t.workspace_id)
    )
  );

-- ── time_entries ──────────────────────────────────────────────────
-- Users see their own entries; workspace admins see all entries in workspace.
CREATE POLICY "time_entries: view own"
  ON time_entries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "time_entries: admins view all"
  ON time_entries FOR SELECT
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "time_entries: create own"
  ON time_entries FOR INSERT
  WITH CHECK (user_id = auth.uid() AND is_workspace_member(workspace_id));

CREATE POLICY "time_entries: update own"
  ON time_entries FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "time_entries: delete own or admin"
  ON time_entries FOR DELETE
  USING (user_id = auth.uid() OR is_workspace_admin(workspace_id));

-- ── invoices_sync ─────────────────────────────────────────────────
CREATE POLICY "invoices_sync: members read"
  ON invoices_sync FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT/UPDATE/DELETE handled by service_role (webhooks).

-- ── support_ticket_links ──────────────────────────────────────────
CREATE POLICY "support_ticket_links: members read"
  ON support_ticket_links FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "support_ticket_links: members manage"
  ON support_ticket_links FOR ALL
  USING (is_workspace_member(workspace_id));

-- ── notifications ─────────────────────────────────────────────────
CREATE POLICY "notifications: view own"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications: mark read (update own)"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications: delete own"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- INSERT by service_role only (webhooks / server-side notification dispatch).

-- ── integration_settings ──────────────────────────────────────────
CREATE POLICY "integration_settings: members read"
  ON integration_settings FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "integration_settings: admins manage"
  ON integration_settings FOR ALL
  USING (is_workspace_admin(workspace_id));

-- ── audit_logs ───────────────────────────────────────────────────
-- Workspace admins can read their own workspace audit trail.
-- Rows are written by service_role or SECURITY DEFINER triggers only.
CREATE POLICY "audit_logs: workspace admins read"
  ON audit_logs FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND is_workspace_admin(workspace_id)
  );
