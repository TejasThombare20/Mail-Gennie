/**
 * run-bounce-scan.ts
 *
 * One-off CLI runner for the bounce scan, bypassing the authenticated API.
 * Useful to re-scan sessions after broadening the bounce-detection matcher.
 *
 * By default it scans whatever sessions are currently 'pending'. Pass --reset
 * to first reset ALL completed/failed sessions back to 'pending' so they are
 * re-scanned from scratch (use this after changing the matcher logic).
 *
 * Usage:
 *   ts-node src/scripts/run-bounce-scan.ts            # scan pending only
 *   ts-node src/scripts/run-bounce-scan.ts --reset    # reset + full re-scan
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import pool from "../config/database";
import { TokenRepository } from "../repository/token.repository";
import { HistoryRepository } from "../repository/history.repository";
import { BounceScanService } from "../services/bounceScan.service";

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");

  const tokenRepository = new TokenRepository(pool);
  const historyRepository = new HistoryRepository(pool);
  const bounceScanService = new BounceScanService(tokenRepository, historyRepository);

  try {
    if (reset) {
      const res = await pool.query(
        `UPDATE email_sessions
            SET scan_status = 'pending'
          WHERE status IN ('completed', 'failed')
            AND scan_status <> 'pending'`
      );
      console.log(`[run-bounce-scan] Reset ${res.rowCount} session(s) to 'pending'`);
    }

    console.log("[run-bounce-scan] Starting scan...");
    const result = await bounceScanService.scanPendingSessions();
    console.log("[run-bounce-scan] Scan complete:", JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error("[run-bounce-scan] Failed:", err?.message ?? err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
