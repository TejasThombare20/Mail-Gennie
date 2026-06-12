-- Migration: Gmail Pub/Sub watch state
-- Date: 2026-06-11
--
-- The pubsub-service tracks, per user:
--   - last_history_id : the Gmail historyId we've processed up to. New Pub/Sub
--     notifications carry a newer historyId; we call history.list(startHistoryId
--     = last_history_id) to fetch what changed, then advance this.
--   - watch_expiry    : gmail.users.watch() subscriptions expire ~7 days out;
--     a renewal job re-arms the watch before this and updates the row.
--   - email_address   : the Gmail address (notifications are keyed by address).

-- NOTE: user_id is VARCHAR, not UUID — users.id stores Google's numeric account
-- id ("sub"), e.g. 101665546276901690478, which is not a UUID. This must match
-- users.id / user_tokens.user_id (both VARCHAR) or arm-watch fails on insert.
CREATE TABLE IF NOT EXISTS gmail_watch_state (
  user_id         VARCHAR(255) PRIMARY KEY,
  email_address   VARCHAR(320) NOT NULL,
  last_history_id BIGINT,
  watch_expiry    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gmail_watch_state_email
  ON gmail_watch_state(email_address);

-- Marks, on email_logs, when an inbound human reply was detected for the thread
-- of a sent email (auto-fills the "who responded" feature previously entered by
-- hand). user_actions already exists (JSONB); the pubsub-service sets
-- user_actions->>'responded' = true and stamps responded_at.
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- The queue flow creates sessions in a 'queued' state before the worker starts
-- sending. The original email_sessions_status_check predates the queue and
-- rejects 'queued', so widen it. (email_logs.status already permits 'queued'.)
ALTER TABLE email_sessions
  DROP CONSTRAINT IF EXISTS email_sessions_status_check;

ALTER TABLE email_sessions
  ADD CONSTRAINT email_sessions_status_check
    CHECK (status IN ('queued', 'pending', 'in_progress', 'completed', 'failed'));
