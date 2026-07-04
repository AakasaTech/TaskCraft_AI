-- ================================================================
--  Add billing/rate fields to clients
-- ================================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS billing_email      text,
  ADD COLUMN IF NOT EXISTS default_hourly_rate numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency            text NOT NULL DEFAULT 'USD';
