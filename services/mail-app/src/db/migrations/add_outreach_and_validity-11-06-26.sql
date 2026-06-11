-- Migration: Outreach tracking + recipient email validity
-- Date: 2026-06-11
--
-- Three additions:
--   1. sent_email_records.is_valid  — tracks whether an address actually delivered.
--      Values: 'not_verified' (default at send time), 'valid', 'failed'.
--      The bounce-scan cron updates this when it confirms delivery / detects a bounce.
--   2. email_logs.user_actions      — per-recipient user-level flags (JSONB), e.g.
--      { "responded": true, "referred": true }. Filled from the History page form.
--      More boolean flags can be added in future without a schema change.
--   3. email_sessions.outreach_details — session-level outreach info (JSONB), e.g.
--      { "interview_scheduled": true, "reachout": { "name": "...", "number": "...",
--        "email": "...", "message": "..." } }. Filled from the Dashboard form.

-- ── 1. sent_email_records.is_valid ──────────────────────────────────────────
ALTER TABLE sent_email_records
  ADD COLUMN IF NOT EXISTS is_valid VARCHAR(20)
    CHECK (is_valid IN ('not_verified', 'valid', 'failed'))
    DEFAULT 'not_verified';

UPDATE sent_email_records SET is_valid = 'not_verified' WHERE is_valid IS NULL;

ALTER TABLE sent_email_records
  ALTER COLUMN is_valid SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sent_email_records_is_valid
  ON sent_email_records(is_valid);

-- ── 2. email_logs.user_actions ──────────────────────────────────────────────
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS user_actions JSONB DEFAULT '{}'::jsonb;

UPDATE email_logs SET user_actions = '{}'::jsonb WHERE user_actions IS NULL;

-- ── 3. email_sessions.outreach_details ──────────────────────────────────────
ALTER TABLE email_sessions
  ADD COLUMN IF NOT EXISTS outreach_details JSONB DEFAULT '{}'::jsonb;

UPDATE email_sessions SET outreach_details = '{}'::jsonb WHERE outreach_details IS NULL;
