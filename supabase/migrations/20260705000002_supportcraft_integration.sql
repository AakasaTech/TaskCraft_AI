-- ============================================================
--  SupportCraft Integration — Schema Additions
-- ============================================================

-- Richer display fields on the ticket link table
ALTER TABLE support_ticket_links
  ADD COLUMN IF NOT EXISTS ticket_status   text DEFAULT 'open'
    CHECK (ticket_status IN ('open','pending','resolved','closed')),
  ADD COLUMN IF NOT EXISTS ticket_priority text DEFAULT 'normal'
    CHECK (ticket_priority IN ('low','normal','high','urgent')),
  ADD COLUMN IF NOT EXISTS client_name     text,
  ADD COLUMN IF NOT EXISTS last_synced_at  timestamptz;
