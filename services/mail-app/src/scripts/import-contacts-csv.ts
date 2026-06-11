/**
 * import-contacts-csv.ts
 *
 * Imports contacts from server/public/extracted_contacts.csv into the
 * `sent_email_records` table with type = 'imported'.
 *
 * CSV columns: "To Name","To Email","To Company","is_sended"
 *
 * Usage:
 *   npm run import-contacts-csv
 *   ts-node src/scripts/import-contacts-csv.ts [path/to/file.csv]
 */

import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import winston from "winston";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "import-contacts-csv.log"),
      format: logFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, "import-contacts-csv-error.log"),
      level: "error",
      format: logFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

// ── RFC 4180 CSV parser ─────────────────────────────────────────────────────
// Handles quoted fields (which may contain commas) and escaped quotes ("").
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      current.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}

// ── Name split ──────────────────────────────────────────────────────────────
function splitName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = fullName.replace(/["']/g, "").trim();
  if (!cleaned) return { firstName: "", lastName: "" };

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1],
  };
}

interface ImportedRecord {
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
}

function normalizeRow(row: string[]): ImportedRecord | null {
  const [toName = "", toEmail = "", toCompany = ""] = row;
  const email = toEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  const { firstName, lastName } = splitName(toName);
  return {
    firstName,
    lastName,
    email,
    companyName: toCompany.trim(),
  };
}

async function persistRecords(
  client: PoolClient,
  records: ImportedRecord[]
): Promise<{ inserted: number; updated: number; failed: number }> {
  if (records.length === 0) {
    return { inserted: 0, updated: 0, failed: 0 };
  }

  // Use created_at as sent_at since these are imported (no actual send time).
  // On conflict keep type as-is so existing 'sent' rows are not downgraded.
  const upsertQuery = `
    INSERT INTO sent_email_records
      (company_name, first_name, last_name, email, sent_at, type)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'imported')
    ON CONFLICT (email) DO UPDATE
      SET company_name = EXCLUDED.company_name,
          first_name   = EXCLUDED.first_name,
          last_name    = EXCLUDED.last_name,
          updated_at   = CURRENT_TIMESTAMP
    RETURNING (xmax = 0) AS inserted
  `;

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const rec of records) {
    try {
      const res = await client.query<{ inserted: boolean }>(upsertQuery, [
        rec.companyName || null,
        rec.firstName || null,
        rec.lastName || null,
        rec.email,
      ]);
      if (res.rows[0]?.inserted) inserted++;
      else updated++;
    } catch (err: any) {
      failed++;
      scriptLogger.error("Failed to upsert record", {
        email: rec.email,
        error: err?.message,
      });
    }
  }

  return { inserted, updated, failed };
}

async function main(): Promise<void> {
  const csvPathArg =
    process.argv[2] ??
    path.resolve(__dirname, "../../public/extracted_contacts.csv");

  scriptLogger.info("=== import-contacts-csv started ===", { csvPath: csvPathArg });

  if (!fs.existsSync(csvPathArg)) {
    scriptLogger.error("CSV file not found", { csvPath: csvPathArg });
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPathArg, "utf8");
  const rows = parseCsv(raw);

  if (rows.length < 2) {
    scriptLogger.error("CSV has no data rows");
    process.exit(1);
  }

  // Skip header row
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim().length > 0));
  scriptLogger.info("CSV parsed", { dataRows: dataRows.length });

  // Dedup within the file by email — last occurrence wins
  const byEmail = new Map<string, ImportedRecord>();
  let skipped = 0;
  for (const row of dataRows) {
    const rec = normalizeRow(row);
    if (!rec) {
      skipped++;
      continue;
    }
    byEmail.set(rec.email, rec);
  }
  const records = Array.from(byEmail.values());
  scriptLogger.info("Records ready for upsert", {
    total: records.length,
    skipped,
  });

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  let dbClient: PoolClient | null = null;
  try {
    dbClient = await pool.connect();
    scriptLogger.info("PostgreSQL connected");

    const stats = await persistRecords(dbClient, records);
    scriptLogger.info("=== import-contacts-csv finished ===", {
      ...stats,
      totalParsed: records.length,
      skipped,
    });
  } catch (err: any) {
    scriptLogger.error("Script aborted", {
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
