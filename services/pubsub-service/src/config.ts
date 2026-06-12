/**
 * pubsub-service configuration. All GCP-specific values come from env so the
 * service is inert (and safe to start) until you provision the topic/sub.
 */
export const pubsubConfig = {
  projectId: process.env.GCP_PROJECT_ID || "",
  /** Fully-qualified topic: projects/<PROJECT>/topics/<TOPIC>. */
  topicName: process.env.GMAIL_PUBSUB_TOPIC || "",
  /** Pull subscription id (short name, in the same project). */
  subscriptionName: process.env.GMAIL_PUBSUB_SUBSCRIPTION || "",
  /** Renew watches expiring within this many hours. */
  watchRenewThresholdHours: Number(process.env.WATCH_RENEW_THRESHOLD_HOURS) || 24,
};

export function assertPubSubConfigured(): string[] {
  const missing: string[] = [];
  if (!pubsubConfig.projectId) missing.push("GCP_PROJECT_ID");
  if (!pubsubConfig.topicName) missing.push("GMAIL_PUBSUB_TOPIC");
  if (!pubsubConfig.subscriptionName) missing.push("GMAIL_PUBSUB_SUBSCRIPTION");
  return missing;
}
