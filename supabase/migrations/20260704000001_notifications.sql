-- ============================================================
--  Notifications
-- ============================================================

-- Step 1: Create table with is_read (skipped if table already exists)
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  workspace_id  uuid        REFERENCES workspaces(id)           ON DELETE CASCADE,
  type          text        NOT NULL,
  title         text        NOT NULL,
  body          text,
  link          text,
  is_read       boolean     NOT NULL DEFAULT false,
  read_at       timestamptz,
  metadata      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Step 2: Rename old 'read' column → 'is_read' if a previous run created the table
--         with the reserved-word column name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notifications'
      AND column_name  = 'read'
  ) THEN
    ALTER TABLE notifications RENAME COLUMN "read" TO is_read;
  END IF;
END $$;

-- Step 3: Index — drop first so the statement is re-runnable
DROP INDEX IF EXISTS notifications_user_read_created_idx;
CREATE INDEX notifications_user_read_created_idx
  ON notifications (user_id, is_read, created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users read their own
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users update their own (mark as read)
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users delete their own
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT is intentionally excluded from user policies.
-- Notifications are created exclusively via the service-role client
-- (lib/supabase/admin.ts) to allow cross-user writes.
