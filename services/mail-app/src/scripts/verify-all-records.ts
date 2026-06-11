/**
 * verify-all-records.ts
 *
 * Verifies the delivery validity of every sent_email_records row still in
 * 'not_verified' state, of type 'sent' (CSV-'imported' rows are intentionally
 * skipped and left 'not_verified').
 *
 * For each address it searches Gmail directly (no session/time window):
 *   - bounce/failure message in the thread → is_valid = 'failed'
 *   - thread exists, no bounce               → is_valid = 'valid'
 *   - no thread found for the address        → left 'not_verified'
 *
 * Addresses are grouped by the user who last emailed them (via email_logs) so we
 * build one Gmail client per user. Addresses with no email_logs row fall back to
 * the default sender (--user <email> or DEFAULT_VERIFY_USER env; otherwise the
 * single user present in the users table).
 *
 * Usage:
 *   ts-node src/scripts/verify-all-records.ts [--user <senderEmail>]
 *   npm run verify-all-records -- --user me@gmail.com
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import pool from "../config/database";
import { TokenRepository } from "../repository/token.repository";
import { HistoryRepository } from "../repository/history.repository";
import { BounceScanService } from "../services/bounceScan.service";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function resolveDefaultUserId(fallbackEmail?: string): Promise<string | null> {
  if (fallbackEmail) {
    const r = await pool.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [fallbackEmail]
    );
    if (r.rowCount) return r.rows[0].id;
    console.warn(`[verify] --user ${fallbackEmail} not found; ignoring`);
  }
  // If there's exactly one user, use them as the default sender.
  const r = await pool.query<{ id: string }>("SELECT id FROM users");
  if (r.rowCount === 1) return r.rows[0].id;
  return null;
}

async function main(): Promise<void> {
  const tokenRepository = new TokenRepository(pool);
  const historyRepository = new HistoryRepository(pool);
  const bounceScanService = new BounceScanService(tokenRepository, historyRepository);

  let valid = 0;
  let failed = 0;
  let stillUnverified = 0;
  let errors = 0;

  try {
    console.log("=== verify-all-records started ===");

    const defaultUserId = await resolveDefaultUserId(
      getArg("--user") || process.env.DEFAULT_VERIFY_USER
    );

    const rows = await historyRepository.getNotVerifiedSentAddresses();
    console.log(`[verify] ${rows.length} not_verified 'sent' address(es) to check`);

    // Group by effective user id
    const byUser = new Map<string, string[]>();
    let skippedNoUser = 0;
    for (const { email, user_id } of rows) {
      const uid = user_id ?? defaultUserId;
      if (!uid) {
        skippedNoUser++;
        continue;
      }
      const list = byUser.get(uid) ?? [];
      list.push(email);
      byUser.set(uid, list);
    }
    if (skippedNoUser > 0) {
      console.warn(
        `[verify] ${skippedNoUser} address(es) had no sender and no default user — skipped`
      );
    }

    for (const [userId, emails] of byUser) {
      let gmail;
      try {
        gmail = await bounceScanService.getGmailClientForUser(userId);
      } catch (err: any) {
        console.error(`[verify] Gmail client failed for user ${userId}: ${err.message}`);
        errors += emails.length;
        continue;
      }

      console.log(`[verify] user ${userId}: verifying ${emails.length} address(es)`);

      for (const email of emails) {
        try {
          const result = await bounceScanService.verifyAddressValidity(gmail, email);
          if (result === "valid") {
            await historyRepository.updateRecordValidity(email, "valid");
            valid++;
          } else if (result === "failed") {
            await historyRepository.updateRecordValidity(email, "failed");
            failed++;
          } else {
            stillUnverified++;
          }
        } catch (err: any) {
          errors++;
          console.warn(`[verify] error for ${email}: ${err.message}`);
        }
        // Gentle pacing to respect Gmail rate limits
        await delay(400);
      }
    }

    console.log("=== verify-all-records finished ===");
    console.log({ valid, failed, stillUnverified, errors });
  } catch (err: any) {
    console.error("[verify] fatal:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
