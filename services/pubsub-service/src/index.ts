import dotenv from "dotenv";
dotenv.config();

process.env.SERVICE_NAME = process.env.SERVICE_NAME || "pubsub-service";

import { connectDB, logger } from "@app/shared";
import { pubsubConfig, assertPubSubConfigured } from "./config";
import { PubSubConsumer } from "./pubsub.consumer";
import { WatchManager } from "./watch.manager";

/**
 * pubsub-service entry point. Long-running: pulls Gmail change notifications and
 * processes bounces/replies. Also renews expiring watches on an interval (a
 * separate cron/systemd-timer can call `npm run renew-watches` instead).
 *
 * Inert until GCP env is set — it logs what's missing and exits cleanly so it
 * never crash-loops before you've provisioned the topic/subscription.
 */
async function main() {
  const missing = assertPubSubConfigured();
  if (missing.length > 0) {
    logger.warn(
      `[pubsub-service] not configured (missing: ${missing.join(", ")}). ` +
        `Set these env vars once the GCP topic/subscription exist. Exiting.`
    );
    return;
  }

  await connectDB();

  const watchManager = new WatchManager(pubsubConfig.topicName);
  const consumer = new PubSubConsumer(pubsubConfig.subscriptionName, pubsubConfig.projectId);

  consumer.start();

  // Renew expiring watches on startup and then daily.
  await watchManager.renewExpiring(pubsubConfig.watchRenewThresholdHours);
  const renewTimer = setInterval(
    () => void watchManager.renewExpiring(pubsubConfig.watchRenewThresholdHours),
    12 * 60 * 60 * 1000
  );

  const shutdown = async (signal: string) => {
    logger.info(`[pubsub-service] received ${signal}, shutting down`);
    clearInterval(renewTimer);
    await consumer.stop();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  logger.info("[pubsub-service] running");
}

main().catch((err) => {
  logger.error("[pubsub-service] fatal startup error", { error: err?.message });
  process.exit(1);
});
