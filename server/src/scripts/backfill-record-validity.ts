/**
 * backfill-record-validity.ts
 *
 * One-off backfill for the new `sent_email_records.is_valid` column.
 *
 * It derives validity from the historical per-recipient `email_logs.status`:
 *   - If an address EVER bounced / failed / was invalid  → is_valid = 'failed'
 *   - Else if an address has at least one 'sent' log      → is_valid = 'valid'
 *   - Otherwise (no usable signal)                        → left as 'not_verified'
 *
 * A 'failed' verdict dominates: a single confirmed bounce marks the address bad
 * even if other sends to it appear to have gone through.
 *
 * IMPORTANT: run the bounce-scan FIRST so any previously-missed failures are
 * recorded as 'bounced' in email_logs before this backfill reads them.
 *
 * Usage:
 *   npm run backfill-record-validity
 *   ts-node src/scripts/backfill-record-validity.ts
 */

import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main(): Promise<void> {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  try {
    console.log("=== backfill-record-validity started ===");

    // 1. Mark addresses that ever bounced/failed/invalid as 'failed'.
    const failedRes = await pool.query(
      `UPDATE sent_email_records ser
          SET is_valid   = 'failed',
              updated_at = CURRENT_TIMESTAMP
        WHERE EXISTS (
          SELECT 1 FROM email_logs el
           WHERE el.recipient_email = ser.email
             AND el.status IN ('bounced', 'failed', 'invalid')
        )`
    );
    console.log(`Marked 'failed' : ${failedRes.rowCount} record(s)`);

    // 2. Mark remaining addresses that have at least one successful send as 'valid'.
    //    Skip anything already set to 'failed' above.
    const validRes = await pool.query(
      `UPDATE sent_email_records ser
          SET is_valid   = 'valid',
              updated_at = CURRENT_TIMESTAMP
        WHERE ser.is_valid <> 'failed'
          AND EXISTS (
            SELECT 1 FROM email_logs el
             WHERE el.recipient_email = ser.email
               AND el.status = 'sent'
          )`
    );
    console.log(`Marked 'valid'  : ${validRes.rowCount} record(s)`);

    // 3. Report what's left unverified (no usable log signal).
    const remainingRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM sent_email_records WHERE is_valid = 'not_verified'`
    );
    console.log(
      `Left 'not_verified' : ${remainingRes.rows[0].n} record(s) (no send/bounce logs found)`
    );

    console.log("=== backfill-record-validity finished ===");
  } catch (err: any) {
    console.error("Backfill failed:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
