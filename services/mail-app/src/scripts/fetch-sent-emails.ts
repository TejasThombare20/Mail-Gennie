/**
 * fetch-sent-emails.ts
 *
 * Fetches all sent emails for a given Gmail account and upserts
 * recipient contact data into the `sent_email_records` PostgreSQL table.
 *
 * Usage:
 *   npm run fetch-sent-emails -- <email>
 *   ts-node src/scripts/fetch-sent-emails.ts iamtejasthombare@gmail.com
 */

import { Pool, PoolClient } from "pg";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import path from "path";
import winston from "winston";

// ── .env ─────────────────────────────────────────────────────────────────────
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── Script-specific logger ────────────────────────────────────────────────────
// Writes to console + logs/fetch-sent-emails.log + logs/fetch-sent-emails-error.log
const LOG_DIR = path.resolve(__dirname, "../../logs");

const logFormat = winston.format.printf(
  ({ level, message, timestamp, stack, ...meta }) => {
    const metaStr =
      Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}]${stack ? `: ${stack}` : `: ${message}`}${metaStr}`;
  }
);

const scriptLogger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" })
  ),
  transports: [
    // Console — colourised
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    // Combined log for this script
    new winston.transports.File({
      filename: path.join(LOG_DIR, "fetch-sent-emails.log"),
      format: logFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    // Error-only log for this script
    new winston.transports.File({
      filename: path.join(LOG_DIR, "fetch-sent-emails-error.log"),
      level: "error",
      format: logFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PARSING HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Company name from domain
// ---------------------------------------------------------------------------
// ccTLD second-level qualifiers — these sit between the company name and the
// country code (e.g. coinswitch.co.in → co is a qualifier, in is the ccTLD)
const CC_SLD_QUALIFIERS = new Set([
  "co", "com", "org", "net", "gov", "edu", "ac", "nic", "or", "ne",
  "me", "in", "us", "gb", "gen", "firm", "store", "web", "arts", "rec",
  "info", "nom",
]);

/**
 * Extracts company name from any email domain.
 *
 * Strategy: work from the right of the domain.
 *  1. Strip ccTLD (1 or 2 parts) to isolate the registered domain segment.
 *  2. The rightmost remaining part is the registered domain = company name.
 *     (handles subdomains: mail.google.com → google, support.aws.amazon.com → amazon)
 *
 * Examples:
 *   tejas@interface.ai           → Interface
 *   madhu@coinswitch.com         → Coinswitch
 *   alice@company.co.uk          → Company
 *   bob@mail.google.com          → Google
 *   carol@support.microsoft.com  → Microsoft
 *   dave@startup.io              → Startup
 *   eve@tech.amazon.com          → Amazon
 *   frank@dept.company.ac.in     → Company
 */
function extractCompanyFromEmail(email: string): string {
  const domain = (email.split("@")[1] ?? "").toLowerCase();
  if (!domain) return "Unknown";

  const parts = domain.split(".");
  if (parts.length === 1) return capitalize(parts[0]);

  // Determine TLD depth
  // e.g. .co.uk → tldDepth = 2   |   .com → tldDepth = 1
  let tldDepth = 1;
  if (
    parts.length >= 3 &&
    CC_SLD_QUALIFIERS.has(parts[parts.length - 2])
  ) {
    tldDepth = 2;
  }

  // Everything before the TLD segment
  const beforeTld = parts.slice(0, parts.length - tldDepth);
  if (beforeTld.length === 0) return "Unknown";

  // The last element of beforeTld is the registered domain name
  const companySlug = beforeTld[beforeTld.length - 1];

  // Clean up hyphens that some domains use (e.g. coca-cola → Coca Cola)
  return companySlug
    .split("-")
    .map(capitalize)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Name from display name or email username
// ---------------------------------------------------------------------------

// Functional mailbox names — we don't want to treat these as people
const FUNCTIONAL_USERNAMES = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply",
  "info", "contact", "hello", "hi", "hey", "team",
  "support", "helpdesk", "help", "service", "services",
  "sales", "marketing", "billing", "payments", "invoice", "invoices",
  "admin", "administrator", "webmaster", "postmaster",
  "newsletter", "news", "updates", "notifications", "alerts",
  "careers", "jobs", "recruit", "recruiting", "hiring",
  "security", "abuse", "spam", "bounce", "reply",
  "hr", "pr", "press", "media", "accounts", "finance",
  "mail", "email", "auto", "automated",
]);

/**
 * Parses first + last name from a "Display Name <email>" display name string.
 * This is the most reliable source when available.
 *
 * Examples:
 *   "Tejas Thombare"           → { firstName: "Tejas",  lastName: "Thombare" }
 *   "Madhu B N"                → { firstName: "Madhu",  lastName: "N" }
 *   "Dr. Alice Smith"          → { firstName: "Alice",  lastName: "Smith" }
 *   "Smith, John"              → { firstName: "John",   lastName: "Smith" }  (Last, First)
 */
function parseNameFromDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
  // Strip quotes and extra whitespace
  const cleaned = displayName.replace(/["']/g, "").trim();

  // "Last, First" pattern (common in Outlook / Exchange)
  const lastFirstMatch = cleaned.match(/^([A-Za-z'-]+),\s+([A-Za-z'-]+)/);
  if (lastFirstMatch) {
    return {
      firstName: capitalize(lastFirstMatch[2]),
      lastName: capitalize(lastFirstMatch[1]),
    };
  }

  // Strip honorifics / suffixes: Dr., Mr., Mrs., Jr., Sr., II, III …
  const withoutHonorific = cleaned
    .replace(/^(Dr|Mr|Mrs|Ms|Miss|Prof|Sir|Rev|Eng)\.?\s+/i, "")
    .replace(/\s+(Jr|Sr|II|III|IV|Esq)\.?$/i, "")
    .trim();

  const parts = withoutHonorific.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: capitalize(parts[0]), lastName: "" };

  // "First [Middle] Last"
  return {
    firstName: capitalize(parts[0]),
    lastName: capitalize(parts[parts.length - 1]),
  };
}

/**
 * Parses first + last name from the username portion of an email address.
 * Falls back to this when no display name is present.
 *
 * Handles patterns (in priority order):
 *   first.last            tejas.thombare        → Tejas / Thombare
 *   first.m.last          tejas.s.thombare      → Tejas / Thombare
 *   f.last                t.thombare            → T / Thombare
 *   first_last            tejas_thombare        → Tejas / Thombare
 *   first-last            tejas-thombare        → Tejas / Thombare
 *   first+last            tejas+thombare        → Tejas / Thombare
 *   PascalCase            TejasThombare         → Tejas / Thombare
 *   lowerCamelCase        tejasThombare         → Tejas / Thombare
 *   ALLCAPS               TEJASTHOMBARE         → Tejas (single)
 *   all lowercase         tejasthombare         → Tejasthombare (single)
 *   single word           tejas                 → Tejas
 */
function parseNameFromEmailUsername(email: string): {
  firstName: string;
  lastName: string;
} {
  const raw = email.split("@")[0].toLowerCase();

  // Bail out for functional mailboxes
  if (FUNCTIONAL_USERNAMES.has(raw)) {
    return { firstName: "", lastName: "" };
  }

  // Normalise separators and strip trailing digits
  // e.g. "tejas.thombare2" → "tejas.thombare"  |  "john+alias" → "john.alias"
  const username = raw
    .replace(/\d+$/, "")           // trailing numbers
    .replace(/[+\-]/g, ".")        // + and - → dot
    .replace(/^[._]+|[._]+$/g, "") // leading/trailing dots or underscores
    .trim();

  if (!username) return { firstName: "", lastName: "" };

  // ── Separator-based patterns ──────────────────────────────────────────────
  // Matches: first.last | first.m.last | f.last | first_last etc.
  if (/[._]/.test(username)) {
    const parts = username.split(/[._]/).filter(Boolean);

    if (parts.length === 1) {
      return { firstName: capitalize(parts[0]), lastName: "" };
    }

    // Skip single-char middle initials: first.m.last → [first, m, last]
    const meaningful = parts.filter((p, i) => p.length > 1 || i === 0 || i === parts.length - 1);

    const first = meaningful[0];
    const last = meaningful[meaningful.length - 1];

    return {
      firstName: capitalize(first),
      // If first and last resolve to the same part, leave last empty
      lastName: first !== last ? capitalize(last) : "",
    };
  }

  // ── PascalCase / lowerCamelCase ───────────────────────────────────────────
  // e.g.  TejasThombare  or  tejasThombare
  // Split on uppercase boundaries: [Tejas, Thombare]
  const camelParts = username
    // insert separator before each uppercase letter preceded by lowercase
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);

  if (camelParts.length >= 2) {
    return {
      firstName: capitalize(camelParts[0]),
      lastName: capitalize(camelParts[camelParts.length - 1]),
    };
  }

  // ── Single token fallback ─────────────────────────────────────────────────
  return { firstName: capitalize(username), lastName: "" };
}

// ---------------------------------------------------------------------------
// Unified entry point for name extraction
// ---------------------------------------------------------------------------
function parseName(
  displayName: string | null,
  email: string
): { firstName: string; lastName: string } {
  if (displayName && displayName.trim().length > 0) {
    // Guard: skip if display name is itself just an email address
    if (!displayName.includes("@")) {
      return parseNameFromDisplayName(displayName);
    }
  }
  return parseNameFromEmailUsername(email);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ADDRESS PARSING
// ═══════════════════════════════════════════════════════════════════════════════

interface ParsedAddress {
  displayName: string | null;
  email: string;
}

/**
 * Parses a single "To" address token into a display name + bare email.
 *
 * Handles:
 *   "Tejas Thombare <tejas@interface.ai>"   → { displayName: "Tejas Thombare", email: "tejas@interface.ai" }
 *   "<tejas@interface.ai>"                  → { displayName: null, email: "tejas@interface.ai" }
 *   "tejas@interface.ai"                    → { displayName: null, email: "tejas@interface.ai" }
 *   "'Tejas' <tejas@interface.ai>"          → { displayName: "Tejas", email: "tejas@interface.ai" }
 */
function parseAddressToken(token: string): ParsedAddress | null {
  const trimmed = token.trim();
  if (!trimmed) return null;

  // "Display Name <email>" or "<email>"
  const angleMatch = trimmed.match(/^(.*?)<([^>]+)>\s*$/);
  if (angleMatch) {
    const rawName = angleMatch[1].replace(/["']/g, "").trim();
    const email = angleMatch[2].trim().toLowerCase();
    if (!email.includes("@")) return null;
    return { displayName: rawName || null, email };
  }

  // Plain email address only
  const plainMatch = trimmed.match(/^([^\s,<>]+@[^\s,<>]+\.[^\s,<>]+)$/);
  if (plainMatch) {
    return { displayName: null, email: plainMatch[1].toLowerCase() };
  }

  return null;
}

/**
 * Splits a "To" header value into individual address tokens.
 * Respects quoted strings so commas inside "Last, First <…>" are not split.
 */
function splitAddressHeader(header: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;

  for (const ch of header) {
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === "," && !inQuote) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());
  return tokens;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. OAUTH / TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Builds an authorised OAuth2Client.
 *
 * Token refresh strategy (in order):
 *   1. Access token still valid → use directly.
 *   2. Access token expired but refresh token present → refresh and persist new tokens.
 *   3. Refresh token expired / revoked (invalid_grant) → fall back to the stored
 *      access token and probe Gmail to see if it still works.
 *   4. Both tokens are dead → throw a clear error asking user to re-authenticate.
 */
async function buildOAuthClient(
  pool: Pool,
  userEmail: string
): Promise<OAuth2Client> {
  scriptLogger.info("Looking up user in DB", { userEmail });

  // -- User lookup
  const userResult = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [userEmail]
  );
  if (!userResult.rowCount || userResult.rowCount === 0) {
    throw new Error(`User not found in DB for email: ${userEmail}`);
  }
  const userId = userResult.rows[0].id;
  scriptLogger.info("User found", { userId, userEmail });

  // -- Token lookup
  const tokenResult = await pool.query<{
    google_token: string;
    token_expiry: Date;
    refresh_token: string | null;
  }>(
    "SELECT google_token, token_expiry, refresh_token FROM user_tokens WHERE user_id = $1",
    [userId]
  );
  if (!tokenResult.rowCount || tokenResult.rowCount === 0) {
    throw new Error(
      `No tokens stored for user: ${userEmail} (userId: ${userId}). ` +
        `The user must sign in through the app first.`
    );
  }

  const { google_token, token_expiry, refresh_token } = tokenResult.rows[0];
  scriptLogger.info("Tokens fetched from DB", {
    userId,
    tokenExpiry: token_expiry,
    hasRefreshToken: !!refresh_token,
  });

  const oauth2Client = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  });

  // Step 1 — check if access token is still valid (with 5-min buffer)
  const accessTokenExpired =
    !token_expiry ||
    new Date(token_expiry) <= new Date(Date.now() + 5 * 60 * 1_000);

  if (!accessTokenExpired) {
    scriptLogger.info("Access token is valid — using directly", { userId });
    oauth2Client.setCredentials({
      access_token: google_token,
      refresh_token: refresh_token ?? undefined,
    });
    return oauth2Client;
  }

  // Step 2 — access token expired; try refreshing
  scriptLogger.info("Access token expired — attempting refresh", { userId });

  if (!refresh_token) {
    scriptLogger.warn(
      "No refresh token stored; will attempt to use expired access token",
      { userId }
    );
    return await probeAccessToken(oauth2Client, google_token, userId, userEmail);
  }

  try {
    oauth2Client.setCredentials({ refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    // Persist the new access token (and new refresh token if Google rotated it)
    await pool.query(
      `UPDATE user_tokens
         SET google_token  = $1,
             token_expiry  = $2,
             refresh_token = COALESCE($3, refresh_token),
             updated_at    = CURRENT_TIMESTAMP
       WHERE user_id = $4`,
      [
        credentials.access_token,
        new Date(credentials.expiry_date!),
        credentials.refresh_token ?? null,
        userId,
      ]
    );
    scriptLogger.info("Access token refreshed and saved to DB", { userId });
    return oauth2Client;
  } catch (refreshErr: any) {
    const isInvalidGrant =
      refreshErr?.message?.includes("invalid_grant") ||
      refreshErr?.response?.data?.error === "invalid_grant";

    if (isInvalidGrant) {
      scriptLogger.warn(
        "Refresh token is expired or revoked (invalid_grant). " +
          "Falling back to stored access token.",
        { userId }
      );
      return await probeAccessToken(
        oauth2Client,
        google_token,
        userId,
        userEmail
      );
    }

    // Some other error — re-throw
    scriptLogger.error("Unexpected error during token refresh", {
      userId,
      error: refreshErr?.message,
    });
    throw refreshErr;
  }
}

/**
 * Sets the stored access token on the client and verifies it with a lightweight
 * Gmail API call. Throws a descriptive error if the token is also dead.
 */
async function probeAccessToken(
  oauth2Client: OAuth2Client,
  accessToken: string,
  userId: string,
  userEmail: string
): Promise<OAuth2Client> {
  oauth2Client.setCredentials({ access_token: accessToken });

  try {
    const testGmail = google.gmail({ version: "v1", auth: oauth2Client });
    await testGmail.users.getProfile({ userId: "me" });
    scriptLogger.info(
      "Stored access token is still accepted by Google despite expiry timestamp",
      { userId }
    );
    return oauth2Client;
  } catch {
    throw new Error(
      `All tokens are invalid for ${userEmail} (userId: ${userId}). ` +
        `The user must re-authenticate through the app to generate fresh tokens.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. FETCH SENT EMAILS
// ═══════════════════════════════════════════════════════════════════════════════

interface SentEmailRecord {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  sentAt: Date;
}

const METADATA_BATCH_SIZE = 50; // parallel requests per batch

/**
 * Pages through Gmail SENT label and returns one SentEmailRecord per unique
 * recipient address found in the To header.
 */
async function fetchAllSentEmails(
  oauth2Client: OAuth2Client
): Promise<SentEmailRecord[]> {
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const records: SentEmailRecord[] = [];
  let pageToken: string | undefined;
  let page = 0;
  let totalMessages = 0;

  scriptLogger.info("Starting Gmail SENT fetch …");

  do {
    page++;
    scriptLogger.info(`Fetching message list page ${page}`, {
      pageToken: pageToken ?? "first",
    });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["SENT"],
      maxResults: 500,
      ...(pageToken ? { pageToken } : {}),
    }); 

    const messages = listRes.data.messages ?? [];
    totalMessages += messages.length;
    scriptLogger.info(`Page ${page}: ${messages.length} message IDs`, {
      totalSoFar: totalMessages,
    });

    // Fetch metadata in parallel batches
    for (let i = 0; i < messages.length; i += METADATA_BATCH_SIZE) {
      const batch = messages.slice(i, i + METADATA_BATCH_SIZE);
      const batchNum = Math.floor(i / METADATA_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(messages.length / METADATA_BATCH_SIZE);

      scriptLogger.info(
        `Page ${page} — metadata batch ${batchNum}/${totalBatches}`,
        { batchSize: batch.length }
      );

      const results = await Promise.allSettled(
        batch.map((msg) =>
          gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "metadata",
            metadataHeaders: ["To", "Date"],
          })
        )
      );

      for (const result of results) {
        if (result.status === "rejected") {
          scriptLogger.warn("Failed to fetch message metadata", {
            reason: String(result.reason),
          });
          continue;
        }

        const headers = result.value.data.payload?.headers ?? [];
        const toHeader =
          headers.find((h) => h.name?.toLowerCase() === "to")?.value ?? "";
        const dateHeader =
          headers.find((h) => h.name?.toLowerCase() === "date")?.value ?? "";

        if (!toHeader) continue;

        const sentAt = dateHeader ? new Date(dateHeader) : new Date();
        if (isNaN(sentAt.getTime())) {
          scriptLogger.warn("Unparseable Date header — using now", {
            dateHeader,
          });
        }

        // Split comma-separated recipients (respects quoted names)
        const tokens = splitAddressHeader(toHeader);

        for (const token of tokens) {
          const parsed = parseAddressToken(token);
          if (!parsed) continue;

          const { displayName, email: recipientEmail } = parsed;
          if (!recipientEmail.includes("@")) continue;

          const { firstName, lastName } = parseName(displayName, recipientEmail);
          const companyName = extractCompanyFromEmail(recipientEmail);

          records.push({
            email: recipientEmail,
            firstName,
            lastName,
            companyName,
            sentAt: isNaN(sentAt.getTime()) ? new Date() : sentAt,
          });
        }
      }
    }

    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken);

  scriptLogger.info("Gmail fetch complete", {
    totalMessages,
    totalAddressesParsed: records.length,
  });
  return records;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PERSIST TO DB
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upserts records into sent_email_records.
 *
 * UNIQUE constraint is on email — on conflict we update name/company/sent_at
 * so re-running the script refreshes stale data.
 */
async function persistRecords(
  client: PoolClient,
  records: SentEmailRecord[]
): Promise<{ inserted: number; updated: number }> {
  if (records.length === 0) {
    scriptLogger.info("No records to persist");
    return { inserted: 0, updated: 0 };
  }

  scriptLogger.info(`Persisting ${records.length} records …`);

  const upsertQuery = `
    INSERT INTO sent_email_records
      (company_name, first_name, last_name, email, sent_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO UPDATE
      SET company_name = EXCLUDED.company_name,
          first_name   = EXCLUDED.first_name,
          last_name    = EXCLUDED.last_name,
          sent_at      = EXCLUDED.sent_at,
          updated_at   = CURRENT_TIMESTAMP
    RETURNING (xmax = 0) AS inserted
  `;

  let inserted = 0;
  let updated = 0;

  for (const rec of records) {
    try {
      const res = await client.query<{ inserted: boolean }>(upsertQuery, [
        rec.companyName,
        rec.firstName,
        rec.lastName,
        rec.email,
        rec.sentAt,
      ]);
      if (res.rows[0]?.inserted) {
        inserted++;
      } else {
        updated++;
      }
    } catch (dbErr: any) {
      scriptLogger.error("Failed to upsert record", {
        email: rec.email,
        error: dbErr?.message,
      });
    }
  }

  scriptLogger.info("DB persist complete", { inserted, updated });
  return { inserted, updated };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  // Step 1 — get email from CLI
  const emailArg = process.argv[2];
  if (!emailArg || !emailArg.includes("@")) {
    scriptLogger.error(
      "Missing or invalid email argument.\n" +
        "Usage : npm run fetch-sent-emails -- <email>\n" +
        "Example: npm run fetch-sent-emails -- iamtejasthombare@gmail.com"
    );
    process.exit(1);
  }

  const userEmail = emailArg.trim().toLowerCase();
  scriptLogger.info("=== fetch-sent-emails script started ===", { userEmail });

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  let dbClient: PoolClient | null = null;

  try {
    // Verify connectivity
    dbClient = await pool.connect();
    scriptLogger.info("PostgreSQL connected successfully", {
      host: process.env.DB_HOST,
      db: process.env.DB_NAME,
    });

    // Step 2 — resolve tokens
    const oauth2Client = await buildOAuthClient(pool, userEmail);

    // Step 3 — pull all sent emails from Gmail
    const records = await fetchAllSentEmails(oauth2Client);

    // Step 4 — persist
    const stats = await persistRecords(dbClient, records);

    scriptLogger.info("=== fetch-sent`-emails script finished ===", {
      userEmail,
      totalParsed: records.length,
      ...stats,
    });
  } catch (err: any) {
    scriptLogger.error("Script aborted due to error", {
      userEmail,
      error: err?.message ?? String(err),
      stack: err?.stack,
    });
    process.exit(1);
  } finally {
    if (dbClient) dbClient.release();
    await pool.end();
    scriptLogger.info("DB connection pool closed");
  }
}

main();
