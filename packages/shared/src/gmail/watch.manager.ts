import { GmailClientFactory } from "./gmail-client.factory";
import { TokenRepository } from "../repository/token.repository";
import { WatchStateRepository } from "../repository/watch-state.repository";
import { getPool } from "../db/database";
import { env } from "../config/env.config";
import logger from "../utils/logger";

/**
 * WatchManager — arms and renews gmail.users.watch() for users. Lives in
 * @app/shared so BOTH the pubsub-service (renewal loop) and mail-app (auto-arm
 * at login) can use it without duplicating logic.
 *
 * watch() tells Gmail to publish a notification to our Pub/Sub topic whenever a
 * user's mailbox changes. It returns a baseline historyId and expires in ~7
 * days, so it must be re-armed before expiry. The topic name is the
 * fully-qualified GCP resource: projects/<PROJECT>/topics/<TOPIC>.
 */
export class WatchManager {
  private readonly gmailFactory: GmailClientFactory;
  private readonly watchRepo: WatchStateRepository;
  private readonly topicName: string;

  /**
   * @param topicName Fully-qualified Pub/Sub topic. Defaults to env.pubsub.topicName
   *   so callers (mail-app) don't need the pubsub-service's local config.
   */
  constructor(topicName?: string) {
    const pool = getPool();
    this.gmailFactory = new GmailClientFactory(new TokenRepository(pool));
    this.watchRepo = new WatchStateRepository(pool);
    this.topicName = topicName || env.pubsub.topicName || "";
  }

  /** True when a topic is configured; lets callers skip arming when GCP isn't set up. */
  isConfigured(): boolean {
    return Boolean(this.topicName);
  }

  /** Arm (or re-arm) the watch for a single user. */
  async arm(userId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        "WatchManager: no Pub/Sub topic configured (GMAIL_PUBSUB_TOPIC)."
      );
    }
    const gmail = await this.gmailFactory.createForUser(userId);

    const profile = await gmail.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress!;

    const res = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: this.topicName,
        labelIds: ["INBOX"],
        labelFilterBehavior: "INCLUDE",
      },
    });

    const historyId = String(res.data.historyId);
    // watch() returns expiration as epoch ms (string).
    const expiry = res.data.expiration
      ? new Date(Number(res.data.expiration))
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.watchRepo.upsertWatch(userId, email, historyId, expiry);
    logger.info("[WatchManager] armed watch", { userId, email, expiry });
  }

  /**
   * Arm the watch ONLY if needed: when no watch row exists yet, or the existing
   * one expires within `thresholdHours`. Idempotent and cheap to call on every
   * login. Returns true if it (re)armed, false if the existing watch was fresh.
   */
  async ensureFresh(
    userId: string,
    thresholdHours = env.pubsub.watchRenewThresholdHours
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const state = await this.watchRepo.get(userId);
    const cutoff = new Date(Date.now() + thresholdHours * 60 * 60 * 1000);

    if (state?.watch_expiry && new Date(state.watch_expiry) > cutoff) {
      // Still valid well beyond the threshold — nothing to do.
      return false;
    }

    await this.arm(userId);
    return true;
  }

  /** Re-arm every watch expiring within `thresholdHours`. */
  async renewExpiring(
    thresholdHours = env.pubsub.watchRenewThresholdHours
  ): Promise<void> {
    const all = await this.watchRepo.listAll();
    const cutoff = new Date(Date.now() + thresholdHours * 60 * 60 * 1000);

    for (const state of all) {
      if (!state.watch_expiry || new Date(state.watch_expiry) <= cutoff) {
        try {
          await this.arm(state.user_id);
        } catch (err) {
          logger.error("[WatchManager] renew failed", {
            userId: state.user_id,
            error: (err as Error).message,
          });
        }
      }
    }
  }
}
