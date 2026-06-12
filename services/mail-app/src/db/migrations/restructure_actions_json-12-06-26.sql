-- Migration: restructure the two "actions" JSONB columns into an extensible,
-- namespaced format, and capture replies automatically via Pub/Sub.
-- Date: 2026-06-12
--
-- BEFORE
--   email_logs.user_actions      : flat  { responded, response_message }   (all empty today)
--   email_logs.responded_at      : timestamptz                              (all NULL today)
--   email_sessions.outreach_details : flat { interviewers:[{name,number,email,company,id}],
--                                             interview_scheduled }
--
-- AFTER
--   email_logs.user_actions      : { mail_replied: [ { response_message, responded_at, source } ] }
--   (responded_at column dropped — the timestamp now lives inside each mail_replied entry)
--   email_sessions.actions       : { outreach: [ { id, interview_scheduler_name, email,
--                                                   contact_number, company } ] }
--   ("interview_scheduled" is derived as outreach.length > 0; no stored flag)

BEGIN;

-- 1. Drop the now-redundant responded_at column (timestamp moves into mail_replied[]).
ALTER TABLE email_logs DROP COLUMN IF EXISTS responded_at;

-- 2. Rename the session column outreach_details -> actions (idempotent guard).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_sessions' AND column_name = 'outreach_details'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_sessions' AND column_name = 'actions'
  ) THEN
    ALTER TABLE email_sessions RENAME COLUMN outreach_details TO actions;
  END IF;
END $$;

-- 3. Migrate existing rows: wrap the old interviewers array under actions.outreach,
--    renaming fields (name -> interview_scheduler_name, number -> contact_number),
--    keeping id, email, company. Rows without 'interviewers' become {} (default).
UPDATE email_sessions
SET actions = jsonb_build_object(
  'outreach',
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id',                      iv->>'id',
          'interview_scheduler_name', iv->>'name',
          'email',                   iv->>'email',
          'contact_number',          iv->>'number',
          'company',                 iv->>'company'
        ))
      )
      FROM jsonb_array_elements(actions->'interviewers') AS iv
    ),
    '[]'::jsonb
  )
)
WHERE actions ? 'interviewers';

-- 4. Normalize any leftover non-conforming session rows to an empty object.
UPDATE email_sessions
SET actions = '{}'::jsonb
WHERE actions IS NULL;

COMMIT;
