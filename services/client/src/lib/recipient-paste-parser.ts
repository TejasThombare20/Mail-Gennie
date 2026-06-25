/**
 * recipient-paste-parser.ts — turns a pasted multi-line block of
 * "email - tag, tag" lines into structured recipient rows for the send form.
 *
 * Input example:
 *   thombaretejas@gmail.com - tejas
 *   otherfaltuwork@gmail.com - tejas, college senior
 *   someone@acme.com - hiring manager, template 4
 *
 * Each non-empty line becomes one row:
 *   - everything before the FIRST " - " (hyphen) is the email,
 *   - everything after it is the free-text tag (also used as the AI hint),
 *   - emails are validated so the UI can flag bad rows,
 *   - a "template N" mention inside the tag yields templateNumber = N, used to
 *     route that recipient to the template whose template_number === N.
 *
 * A line with no dash is treated as an email with an empty tag.
 */

// Simple, permissive email check — matches the spirit of zod's .email() without
// pulling a dependency. Good enough to flag obviously-bad pasted addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRecipient {
  /** The email address, trimmed (may be invalid — see isValidEmail). */
  email: string;
  /** The raw tag text after the dash (e.g. "tejas, college senior"). */
  tag: string;
  /** Whether `email` passes the basic email-format check. */
  isValidEmail: boolean;
  /** Template number parsed from a "template N" mention in the tag, if any. */
  templateNumber: number | null;
}

/** True when `email` looks like a valid address. */
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Parse a "template N" mention from a tag (case-insensitive: template / Template
 * / TEMPLATE, optional space before the digits). Returns the number or null.
 */
export function parseTemplateNumber(tag: string): number | null {
  const m = /template\s*(\d+)/i.exec(tag);
  return m ? Number(m[1]) : null;
}

/**
 * Split a pasted block into structured recipient rows. Blank lines are skipped.
 * The first " - " (space-hyphen-space) OR a bare "-" separates email from tag;
 * we prefer splitting on the first hyphen so emails (which never contain a bare
 * " - ") stay intact.
 */
export function parseRecipientBlock(block: string): ParsedRecipient[] {
  const rows: ParsedRecipient[] = [];

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // The email/tag separator is a hyphen. Emails can contain hyphens in both
    // the local part (john-doe@x.com) and domain (a@my-co.com), so we cannot
    // split on just any "-". Strategy:
    //   1. Prefer a whitespace-padded hyphen " - " (the documented paste format).
    //   2. Otherwise, split on the first hyphen that comes after the domain dot
    //      (i.e. after the last "." that follows the "@"), so domain hyphens stay.
    //   3. If neither applies, the whole line is the email with no tag.
    let splitIdx = line.search(/\s-\s/);
    let sepLen = 3; // length of " - "
    if (splitIdx === -1) {
      const atIdx = line.indexOf("@");
      const dotIdx = atIdx === -1 ? -1 : line.indexOf(".", atIdx);
      const searchFrom = dotIdx === -1 ? 0 : dotIdx;
      splitIdx = line.indexOf("-", searchFrom);
      sepLen = 1;
    }

    let email: string;
    let tag: string;
    if (splitIdx === -1) {
      email = line;
      tag = "";
    } else {
      email = line.slice(0, splitIdx).trim();
      tag = line.slice(splitIdx + sepLen).trim();
    }

    rows.push({
      email,
      tag,
      isValidEmail: isValidEmail(email),
      templateNumber: parseTemplateNumber(tag),
    });
  }

  return rows;
}
