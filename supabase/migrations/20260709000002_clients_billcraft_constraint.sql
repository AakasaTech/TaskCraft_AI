-- Replace the partial unique index with a proper unique constraint so that
-- Supabase upsert (PostgREST ON CONFLICT) can resolve the conflict target.
-- PostgreSQL treats NULLs as distinct in unique indexes, so rows with
-- billcraft_client_id = NULL are still allowed to coexist freely.

DROP INDEX IF EXISTS clients_workspace_billcraft_id_idx;

ALTER TABLE clients
  ADD CONSTRAINT clients_workspace_billcraft_id_key
  UNIQUE (workspace_id, billcraft_client_id);
