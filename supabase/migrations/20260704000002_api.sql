-- ============================================================
--  Public API — API Keys, Webhooks, Webhook Deliveries
-- ============================================================

-- ── API Keys ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  name         text        NOT NULL,
  key_hash     text        NOT NULL UNIQUE,   -- SHA-256 of the raw key
  key_prefix   text        NOT NULL,          -- First 16 chars, for display
  scopes       text[]      NOT NULL DEFAULT ARRAY['read'],
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_workspace_idx ON api_keys (workspace_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx      ON api_keys (key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only workspace members (owner/admin) can manage keys for their workspace
CREATE POLICY "api_keys_select_own_workspace"
  ON api_keys FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "api_keys_insert_own_workspace"
  ON api_keys FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "api_keys_update_own_workspace"
  ON api_keys FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Webhooks ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  name          text        NOT NULL,
  url           text        NOT NULL,
  secret        text        NOT NULL,   -- HMAC signing secret, shown once
  events        text[]      NOT NULL,   -- Subscribed event types
  active        boolean     NOT NULL DEFAULT true,
  last_fired_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhooks_workspace_idx ON webhooks (workspace_id, active);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks_manage_own_workspace"
  ON webhooks FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── Webhook Deliveries ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id   uuid        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event        text        NOT NULL,
  payload      jsonb       NOT NULL,
  status_code  integer,
  response     text,
  error        text,
  delivered_at timestamptz,
  attempts     integer     NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx
  ON webhook_deliveries (webhook_id, created_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_select_own_workspace"
  ON webhook_deliveries FOR SELECT
  USING (
    webhook_id IN (
      SELECT id FROM webhooks WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );
