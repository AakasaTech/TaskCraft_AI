-- ================================================================
--  Add 'not_started' project status
-- ================================================================

-- For ENUM type (if project_status was created as a custom type)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'not_started';
  END IF;
END $$;

-- For CHECK constraint path: drop old constraint and recreate with new value
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('not_started', 'active', 'on_hold', 'completed', 'archived'));

-- New projects start as 'not_started' by default
ALTER TABLE projects
  ALTER COLUMN status SET DEFAULT 'not_started';
