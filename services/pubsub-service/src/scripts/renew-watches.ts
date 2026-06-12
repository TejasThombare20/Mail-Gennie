import dotenv from "dotenv";
dotenv.config();
process.env.SERVICE_NAME = "pubsub-renew";

import { connectDB, logger } from "@app/shared";
import { pubsubConfig, assertPubSubConfigured } from "../config";
import { WatchManager } from "../watch.manager";

/**
 * One-shot watch renewal — run from cron / a systemd timer (e.g. daily). Re-arms
 * any gmail watch expiring within the threshold. Exits when done.
 */
async function main() {
  const missing = assertPubSubConfigured();
  if (missing.length > 0) {
    logger.error(`[renew-watches] missing config: ${missing.join(", ")}`);
    process.exit(1);
  }
  await connectDB();
  const manager = new WatchManager(pubsubConfig.topicName);
  await manager.renewExpiring(pubsubConfig.watchRenewThresholdHours);
  logger.info("[renew-watches] done");
  process.exit(0);
}

main().catch((err) => {
  logger.error("[renew-watches] failed", { error: err?.message });
  process.exit(1);
});
