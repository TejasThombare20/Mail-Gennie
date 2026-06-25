-- Migration: add a default subject and a stable template number to templates
-- Date: 2026-06-15
--
-- Why:
--   subject          : each template now carries a DEFAULT subject line. The send
--                      form prefills it when a template is selected, and the user
--                      may overwrite it. Placeholders ({{...}}) inside the subject
--                      are already resolved by TemplateRenderer before sending, so
--                      a subject like "Referral for {{ROLE}} at {{company_name}}"
--                      works out of the box.
--   template_number  : a small, human-meaningful number per template (1, 2, 3, 4…)
--                      used for tag-based routing on the send form. When a pasted
--                      recipient is tagged with "template 4", the UI routes that
--                      recipient to the template whose template_number = 4 while
--                      everyone else uses the selected template.
--
-- Both columns are nullable so the migration is non-destructive on existing rows.
-- template_number is unique PER USER (a user can't have two "template 4"s), but
-- NULLs are allowed and not constrained — hence the partial unique index.

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS subject TEXT;

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS template_number INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_user_template_number
  ON templates (user_id, template_number)
  WHERE template_number IS NOT NULL;
