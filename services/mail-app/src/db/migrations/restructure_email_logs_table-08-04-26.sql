-- Migration: Restructure email_logs to per-recipient rows linked to email_sessions
-- Date: 2026-04-08
--
-- Before: email_logs stored all recipients as JSONB array in receiver_emails column
-- After:  email_logs stores one row per recipient, linked to an email_session via session_id

-- Step 1: Add new columns to email_logs
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES email_sessions(id);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS local_variables JSONB;

-- Step 2: Migrate existing data
-- For each existing email_log row, create an email_session and individual email_log rows
DO $$
DECLARE
    log_record RECORD;
    new_session_id UUID;
    recipient RECORD;
    recipient_count INTEGER;
    sent_count INTEGER;
    failed_count INTEGER;
BEGIN
    FOR log_record IN SELECT * FROM email_logs WHERE session_id IS NULL AND receiver_emails IS NOT NULL
    LOOP
        -- Count recipients
        SELECT COUNT(*) INTO recipient_count FROM jsonb_array_elements(log_record.receiver_emails);
        SELECT COUNT(*) INTO sent_count FROM jsonb_array_elements(log_record.receiver_emails) AS r WHERE r->>'status' = 'sent';
        SELECT COUNT(*) INTO failed_count FROM jsonb_array_elements(log_record.receiver_emails) AS r WHERE r->>'status' = 'failed';

        -- Create a session for this old log
        INSERT INTO email_sessions (user_id, template_id, subject, global_variables, total_emails, sent_count, failed_count, status, started_at, completed_at)
        VALUES (
            log_record.user_id,
            log_record.template_id,
            log_record.subject,
            log_record.global_variables,
            recipient_count,
            sent_count,
            failed_count,
            log_record.status,
            log_record.sent_at,
            log_record.last_updated
        )
        RETURNING id INTO new_session_id;

        -- Create individual email_log rows for each recipient
        FOR recipient IN SELECT * FROM jsonb_array_elements(log_record.receiver_emails) AS r
        LOOP
            INSERT INTO email_logs (user_id, template_id, global_variables, subject, status, sent_at, last_updated, session_id, recipient_email, local_variables)
            VALUES (
                log_record.user_id,
                log_record.template_id,
                log_record.global_variables,
                log_record.subject,
                (recipient.r->>'status'),
                log_record.sent_at,
                log_record.last_updated,
                new_session_id,
                (recipient.r->>'email'),
                (recipient.r->'variables')
            );
        END LOOP;

        -- Delete the old aggregated row
        DELETE FROM email_logs WHERE id = log_record.id;
    END LOOP;
END $$;

-- Step 3: Drop the old receiver_emails column (no longer needed)
ALTER TABLE email_logs DROP COLUMN IF EXISTS receiver_emails;

-- Step 4: Add index for session lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_session_id ON email_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_email ON email_logs(recipient_email);
