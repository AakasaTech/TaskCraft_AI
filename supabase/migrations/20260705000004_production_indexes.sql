-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 21 – Production indexes and cleanup
-- ─────────────────────────────────────────────────────────────────────────────

-- workspace_invitations: fast lookup of non-expired pending invites
CREATE INDEX IF NOT EXISTS idx_wi_pending
  ON workspace_invitations(workspace_id, accepted_at, expires_at)
  WHERE accepted_at IS NULL;

-- notifications: cursor-based pagination (user feed by time)
CREATE INDEX IF NOT EXISTS idx_notif_user_cursor
  ON notifications(user_id, created_at DESC);

-- time_entries: team timesheet range queries
CREATE INDEX IF NOT EXISTS idx_te_workspace_start
  ON time_entries(workspace_id, start_time DESC);

-- task_activity: workspace activity feed (via tasks join)
CREATE INDEX IF NOT EXISTS idx_ta_task_created
  ON task_activity(task_id, created_at DESC);

-- tasks: workload view (workspace + assignee)
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_assignee
  ON tasks(workspace_id, assignee_id)
  WHERE assignee_id IS NOT NULL;

-- tasks: status-filtered queries
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status
  ON tasks(workspace_id, status);

-- invoices_sync: client-filtered queries
CREATE INDEX IF NOT EXISTS idx_isync_workspace_client
  ON invoices_sync(workspace_id, client_id);

-- support_ticket_links: client name lookup
CREATE INDEX IF NOT EXISTS idx_stl_workspace_client
  ON support_ticket_links(workspace_id, client_name);
