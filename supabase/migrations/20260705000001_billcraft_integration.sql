-- ============================================================
--  BillCraft Integration — Schema Additions
-- ============================================================

-- Link each time entry back to the invoice sync record it was included in
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS invoice_sync_id uuid REFERENCES invoices_sync(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_te_invoice_sync_id
  ON time_entries (invoice_sync_id) WHERE invoice_sync_id IS NOT NULL;

-- Enrich invoices_sync with display + date-range fields
ALTER TABLE invoices_sync
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS date_from      date,
  ADD COLUMN IF NOT EXISTS date_to        date,
  ADD COLUMN IF NOT EXISTS entry_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes          text;
