-- ================================================================
--  TaskCraft AI — Seed Data
--  Run after migrations. Safe to re-run (uses ON CONFLICT DO NOTHING).
-- ================================================================

-- ── Plan definitions ─────────────────────────────────────────────
INSERT INTO plans (id, name, price_monthly, price_yearly, max_workspaces, max_projects, max_members, features)
VALUES
  (
    'free',
    'Free',
    0, 0,
    1,   -- 1 workspace
    3,   -- 3 projects
    1,   -- solo only
    '{
      "time_tracking":   true,
      "billable_hours":  false,
      "reports_days":    7,
      "exports":         false,
      "integrations":    false,
      "team_management": false
    }'::jsonb
  ),
  (
    'solo',
    'Solo',
    9, 89,
    1,   -- 1 workspace
    -1,  -- unlimited projects
    1,   -- solo only
    '{
      "time_tracking":   true,
      "billable_hours":  true,
      "reports_days":    -1,
      "exports":         true,
      "integrations":    true,
      "team_management": false
    }'::jsonb
  ),
  (
    'team',
    'Team',
    19, 189,
    -1,  -- unlimited workspaces
    -1,  -- unlimited projects
    -1,  -- unlimited members
    '{
      "time_tracking":   true,
      "billable_hours":  true,
      "reports_days":    -1,
      "exports":         true,
      "integrations":    true,
      "team_management": true,
      "admin_panel":     true
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
