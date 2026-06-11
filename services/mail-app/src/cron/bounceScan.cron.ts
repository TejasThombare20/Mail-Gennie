/**
 * Bounce Scan Cron Job
 *
 * Runs every 10 minutes to scan completed email sessions for bounced emails.
 * Uses node-cron for scheduling.
 */

import cron, { ScheduledTask } from "node-cron";
import { BounceScanService } from "../services/bounceScan.service";
import logger from "../utils/logger";

let isRunning = false;

/**
 * Execute a single bounce scan run.
 * Exported so it can be triggered manually via API.
 * Includes a lock to prevent concurrent scans.
 */
export async function runBounceScan(
  bounceScanService: BounceScanService
): Promise<{ success: boolean; message: string; data?: any }> {
  if (isRunning) {
    logger.warn("[BounceScan Cron] Scan already in progress, skipping");
    return {
      success: false,
      message: "Bounce scan already in progress, please wait for it to finish",
    };
  }

  isRunning = true;
  try {
    logger.info("[BounceScan Cron] Starting bounce scan...");
    const result = await bounceScanService.scanPendingSessions();
    logger.info("[BounceScan Cron] Bounce scan completed", result);
    return {
      success: true,
      message: `Scan complete. Scanned ${result.sessionsScanned} session(s), found ${result.totalBounces} bounce(s).`,
      data: result,
    };
  } catch (err: any) {
    logger.error("[BounceScan Cron] Bounce scan failed", { error: err.message });
    return {
      success: false,
      message: `Bounce scan failed: ${err.message}`,
    };
  } finally {
    isRunning = false;
  }
}

/**
 * Start the cron job that runs bounce scan every 10 minutes.
 */
export function startBounceScanCron(bounceScanService: BounceScanService): ScheduledTask {
  // Every 10 minutes
  const task = cron.schedule("*/10 * * * *", async () => {
    await runBounceScan(bounceScanService);
  });

  logger.info("[BounceScan Cron] Scheduled bounce scan to run every 10 minutes");
  return task;
}
