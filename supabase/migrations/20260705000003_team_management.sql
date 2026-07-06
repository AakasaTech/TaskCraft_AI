-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 20 – Team Management
-- ─────────────────────────────────────────────────────────────────────────────

-- Expand workspace_members.role check constraint to include 'manager'
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.workspace_members'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%owner%'
    AND pg_get_constraintdef(oid) LIKE '%viewer%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE workspace_members DROP CONSTRAINT %I', cname);
  END IF;

  BEGIN
    ALTER TABLE workspace_members
      ADD CONSTRAINT workspace_members_role_check
      CHECK (role IN ('owner','admin','manager','member','viewer'));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- ── workspace_invitations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  role         text        NOT NULL DEFAULT 'member'
               CHECK (role IN ('admin','manager','member','viewer')),
  token        text        NOT NULL UNIQUE,
  invited_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at  timestamptz,
  expires_at   timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wi_workspace ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wi_token     ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_wi_email     ON workspace_invitations(email);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_invitations: members can view"
  ON workspace_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
    )
  );
