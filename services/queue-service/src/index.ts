import dotenv from "dotenv";
dotenv.config();

process.env.SERVICE_NAME = process.env.SERVICE_NAME || "queue-service";

import { connectDB, logger } from "@app/shared";
import { QueueWorker } from "./worker";

/**
 * queue-service entry point. Long-running process: starts the graphile-worker
 * runner and stays up draining send jobs. Run under pm2/systemd with
 * restart-always so reboots/crashes self-heal (job state lives in Postgres).
 */
async function main() {
  await connectDB();

  const worker = QueueWorker.getInstance();
  await worker.start();

  const shutdown = async (signal: string) => {
    logger.info(`[queue-service] received ${signal}, shutting down`);
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  logger.info("[queue-service] running");
}

main().catch((err) => {
  logger.error("[queue-service] fatal startup error", { error: err?.message });
  process.exit(1);
});
