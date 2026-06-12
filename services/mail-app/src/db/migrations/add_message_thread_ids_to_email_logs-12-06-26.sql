-- Migration: persist the Gmail message + thread id of each sent email
-- Date: 2026-06-12
--
-- Why: the pubsub-service attributes inbound replies/bounces back to the
-- email_logs row they belong to. Previously it could only match by recipient
-- address and pick the *latest* sent log, which mis-credits a reply when the
-- same recipient was emailed in two different sessions.
--
-- With the message + thread ids stored on send, a genuine reply can be matched
-- EXACTLY:
--   - reply shares the same Gmail threadId as our sent message (tier 1), OR
--   - reply's In-Reply-To / References headers contain our RFC822 Message-ID
--     (tier 2).
-- Rows sent before this migration have NULLs here and fall back to the
-- nearest-by-sent_at heuristic in InboxEventRepository (tier 3).
--
-- Three distinct identifiers are involved — keep them straight:
--   gmail_message_id  : Gmail's INTERNAL message id from messages.send response
--                       (.data.id), a hex string like "18f0a1b2c3d4e5f6".
--   thread_id         : Gmail's INTERNAL thread id (.data.threadId), same form.
--   rfc822_message_id : the RFC822 "Message-ID" HEADER of the sent message
--                       (e.g. "<CAB...@mail.gmail.com>"). This is what a reply's
--                       In-Reply-To/References headers actually contain, so it
--                       is the value tier-2 matching compares against. It is NOT
--                       the same as gmail_message_id.
-- All nullable VARCHAR so the migration is non-destructive on existing rows.

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS gmail_message_id VARCHAR(255);

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS thread_id VARCHAR(255);

ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS rfc822_message_id VARCHAR(998);

-- Thread lookups drive tier-1; rfc822 id lookups drive tier-2. Index both.
CREATE INDEX IF NOT EXISTS idx_email_logs_thread_id
  ON email_logs(thread_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_rfc822_message_id
  ON email_logs(rfc822_message_id);
