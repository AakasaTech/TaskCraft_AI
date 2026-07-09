-- Add billcraft_client_id to clients so BillCraft sync can upsert idempotently.
-- A unique partial index on (workspace_id, billcraft_client_id) handles re-syncs
-- without touching manually-created clients (which have a NULL billcraft_client_id).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS billcraft_client_id text;

CREATE UNIQUE INDEX IF NOT EXISTS clients_workspace_billcraft_id_idx
  ON clients (workspace_id, billcraft_client_id)
  WHERE billcraft_client_id IS NOT NULL;
