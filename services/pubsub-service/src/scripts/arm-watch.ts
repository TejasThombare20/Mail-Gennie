import dotenv from "dotenv";
dotenv.config();
process.env.SERVICE_NAME = "pubsub-arm";

import { connectDB, logger } from "@app/shared";
import { pubsubConfig, assertPubSubConfigured } from "../config";
import { WatchManager } from "../watch.manager";

/**
 * Arm a Gmail watch for a single user. Usage:
 *   npm run arm-watch --workspace=@app/pubsub-service -- <userId>
 * The user must already have valid Google tokens stored.
 */
async function main() {
  const userId = process.argv[2];
  if (!userId) {
    logger.error("[arm-watch] usage: arm-watch <userId>");
    process.exit(1);
  }
  const missing = assertPubSubConfigured();
  if (missing.length > 0) {
    logger.error(`[arm-watch] missing config: ${missing.join(", ")}`);
    process.exit(1);
  }
  await connectDB();
  const manager = new WatchManager(pubsubConfig.topicName);
  await manager.arm(userId);
  logger.info("[arm-watch] armed", { userId });
  process.exit(0);
}

main().catch((err) => {
  logger.error("[arm-watch] failed", { error: err?.message });
  process.exit(1);
});
