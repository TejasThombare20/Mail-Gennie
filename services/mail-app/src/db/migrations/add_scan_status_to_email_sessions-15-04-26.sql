-- Migration: Add scan_status to email_sessions for bounce detection cron job
-- Date: 2026-04-15
--
-- Adds a scan_status column to track whether a session's emails have been
-- scanned for bounces/delivery failures via Gmail API.
-- Values: 'pending' (default), 'in_progress', 'done'

ALTER TABLE email_sessions
  ADD COLUMN IF NOT EXISTS scan_status VARCHAR(20)
    CHECK (scan_status IN ('pending', 'in_progress', 'done'))
    DEFAULT 'pending';

-- Backfill existing rows to 'pending'
UPDATE email_sessions SET scan_status = 'pending' WHERE scan_status IS NULL;

-- Index for the cron job to quickly find unscanned sessions
CREATE INDEX IF NOT EXISTS idx_email_sessions_scan_status ON email_sessions(scan_status);

-- Add 'bounced' as a valid status for email_logs
-- Drop old check constraint and recreate with 'bounced' included
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_status_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_status_check
  CHECK (status IN ('sent', 'failed', 'queued', 'pending', 'invalid', 'bounced'));
