import { PubSub, Message, Subscription } from "@google-cloud/pubsub";
import { logger } from "@app/shared";
import { HistoryProcessor } from "./history.processor";

interface GmailNotification {
  emailAddress: string;
  historyId: string | number;
}

/**
 * PubSubConsumer — PULL subscriber for Gmail change notifications.
 *
 * We use a PULL subscription (not push) deliberately: it works behind NAT / on a
 * home laptop with no public URL, and Pub/Sub RETAINS messages (up to 7 days)
 * while we're offline, redelivering them when we reconnect. A message is only
 * ack()'d after we've successfully processed it; on failure we nack() so Pub/Sub
 * redelivers.
 *
 * Each Gmail notification payload is base64 JSON: { emailAddress, historyId }.
 * It contains NO email content — we hand it to the HistoryProcessor which calls
 * Gmail history.list to discover what actually changed.
 */
export class PubSubConsumer {
  private readonly pubsub: PubSub;
  private subscription: Subscription | null = null;
  private readonly processor = new HistoryProcessor();

  constructor(
    private subscriptionName: string,
    projectId?: string
  ) {
    this.pubsub = new PubSub(projectId ? { projectId } : {});
  }

  start(): void {
    this.subscription = this.pubsub.subscription(this.subscriptionName, {
      flowControl: { maxMessages: 5 }, // small: our handler is I/O heavy
    });

    this.subscription.on("message", (message: Message) => {
      void this.handle(message);
    });
    this.subscription.on("error", (err) => {
      logger.error("[PubSubConsumer] subscription error", { error: err?.message });
    });

    logger.info("[PubSubConsumer] listening (pull)", { subscription: this.subscriptionName });
  }

  private async handle(message: Message): Promise<void> {
    try {
      const decoded = JSON.parse(message.data.toString()) as GmailNotification;
      if (!decoded.emailAddress || decoded.historyId == null) {
        logger.warn("[PubSubConsumer] malformed notification, acking", {
          data: message.data.toString().slice(0, 200),
        });
        message.ack();
        return;
      }

      await this.processor.process(decoded.emailAddress, String(decoded.historyId));
      message.ack(); // only after successful processing
    } catch (err) {
      // nack -> Pub/Sub redelivers later (with backoff). Don't lose the event.
      logger.error("[PubSubConsumer] processing failed, nacking", {
        error: (err as Error).message,
      });
      message.nack();
    }
  }

  async stop(): Promise<void> {
    if (this.subscription) {
      await this.subscription.close();
      this.subscription = null;
      logger.info("[PubSubConsumer] stopped");
    }
  }
}
