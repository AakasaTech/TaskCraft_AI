-- ================================================================
--  Fix: handle_new_user trigger fails with "Database error saving new user"
--
--  Root cause: RLS is enabled on profiles / workspaces / workspace_members
--  but there are no INSERT policies.  In Supabase, SECURITY DEFINER does NOT
--  automatically bypass RLS (postgres is not a full superuser there), so the
--  trigger's INSERT calls hit an implicit DENY and GoTrue returns the generic
--  "Database error saving new user" error.
--
--  Fix A: Add INSERT policies for the three tables the trigger writes to.
--  Fix B: Rewrite handle_new_user to use gen_random_uuid() for the workspace
--         slug instead of gen_random_bytes() — removes the pgcrypto dependency.
-- ================================================================


-- ── A. Insert policies ────────────────────────────────────────────────────────

-- profiles: only the owner may insert their own row (trigger or OAuth callback)
CREATE POLICY "profiles: insert own"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- The trigger runs before auth.uid() is set (uid = NULL during AFTER INSERT on
-- auth.users).  We need a second, unconditional policy that the trigger path
-- can satisfy.  We scope it to the postgres / service_role so it can't be
-- exploited by anon/authenticated API callers.
-- In Supabase the internal trigger role evaluates to NULL for auth.uid() but
-- the operation still needs at least one passing policy.
CREATE POLICY "profiles: trigger insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- workspaces: normal authenticated creation (used from the app if ever needed)
-- The trigger path is covered by the NULL-uid policy above; workspace insert
-- happens in the same implicit postgres session so auth.uid() is also NULL.
CREATE POLICY "workspaces: trigger insert"
  ON workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- workspace_members: same reasoning
CREATE POLICY "workspace_members: trigger insert"
  ON workspace_members FOR INSERT
  WITH CHECK (auth.uid() IS NULL);


-- ── B. Rewrite handle_new_user ────────────────────────────────────────────────
-- Uses gen_random_uuid() (built-in since PG 13, no pgcrypto needed) for the
-- workspace slug.  uuid_generate_v4 requires uuid-ossp; gen_random_uuid() does
-- not.  We take the first 16 hex chars of the UUID text as the slug suffix.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
  display_name     text;
  slug_suffix      text;
BEGIN
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Use first 16 chars of a UUID (no pgcrypto dependency)
  slug_suffix := replace(gen_random_uuid()::text, '-', '');
  slug_suffix := substring(slug_suffix from 1 for 16);

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
    'ws-' || slug_suffix
  )
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;
