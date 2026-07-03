-- ── AI usage tracking (for Free plan monthly limits) ──────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tool         text        NOT NULL,
  used_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month
  ON ai_usage(user_id, used_at DESC);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage: own"
  ON ai_usage FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
