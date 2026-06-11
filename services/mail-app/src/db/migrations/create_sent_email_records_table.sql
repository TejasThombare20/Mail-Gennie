-- Table: sent_email_records
-- Stores one contact record per unique recipient email extracted from Gmail SENT folder.
-- On re-run the script upserts: updates name/company/sent_at for existing emails.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sent_email_records (
  id           UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255),
  first_name   VARCHAR(100),
  last_name    VARCHAR(100),
  email        VARCHAR(255)             NOT NULL,
  sent_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sent_email_records_email_unique UNIQUE (email)
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_sent_email_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 

DROP TRIGGER IF EXISTS trg_sent_email_records_updated_at ON sent_email_records;

CREATE TRIGGER trg_sent_email_records_updated_at
BEFORE UPDATE ON sent_email_records
FOR EACH ROW
EXECUTE FUNCTION update_sent_email_records_updated_at();
