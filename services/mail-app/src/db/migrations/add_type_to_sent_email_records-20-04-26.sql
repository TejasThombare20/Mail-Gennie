-- Migration: Add type column to sent_email_records
-- Date: 2026-04-20
--
-- Distinguishes records that came from the Gmail SENT scan ('sent')
-- from records bulk-loaded from an external contacts source ('imported').

ALTER TABLE sent_email_records
  ADD COLUMN IF NOT EXISTS type VARCHAR(20)
    CHECK (type IN ('sent', 'imported'))
    DEFAULT 'sent';

-- Backfill existing rows to 'sent'
UPDATE sent_email_records SET type = 'sent' WHERE type IS NULL;

ALTER TABLE sent_email_records
  ALTER COLUMN type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sent_email_records_type ON sent_email_records(type);
