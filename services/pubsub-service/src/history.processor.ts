import { gmail_v1 } from "googleapis";
import {
  GmailClientFactory,
  TokenRepository,
  WatchStateRepository,
  InboxEventRepository,
  getPool,
  logger,
} from "@app/shared";
import {
  BounceDetector,
  ReplyDetector,
  ClassifiedMessage,
} from "./detectors/message.detectors";

/**
 * HistoryProcessor — the core of the pubsub-service.
 *
 * Given a Pub/Sub notification ({ emailAddress, historyId }), it:
 *   1. resolves the user + their last processed historyId,
 *   2. calls Gmail history.list(startHistoryId = lastHistoryId) to get the
 *      messages that changed since,
 *   3. classifies each changed message (bounce / reply) via the detectors,
 *   4. attributes it to a previously-sent email_log and applies the DB update,
 *   5. advances last_history_id.
 *
 * If startHistoryId is too old (Gmail 404s), we reset the cursor to the new
 * historyId — losing nothing critical because the bounce-scan cron remains as a
 * backstop for older sessions.
 */
export class HistoryProcessor {
  private readonly gmailFactory: GmailClientFactory;
  private readonly watchRepo: WatchStateRepository;
  private readonly inboxRepo: InboxEventRepository;
  private readonly bounceDetector = new BounceDetector();

  constructor() {
    const pool = getPool();
    this.gmailFactory = new GmailClientFactory(new TokenRepository(pool));
    this.watchRepo = new WatchStateRepository(pool);
    this.inboxRepo = new InboxEventRepository(pool);
  }

  async process(emailAddress: string, newHistoryId: string): Promise<void> {
    const state = await this.watchRepo.getByEmail(emailAddress);
    if (!state) {
      logger.warn("[HistoryProcessor] no watch state for address; ignoring", { emailAddress });
      return;
    }

    const gmail = await this.gmailFactory.createForUser(state.user_id);
    const replyDetector = new ReplyDetector(emailAddress);

    const startHistoryId = state.last_history_id;
    if (!startHistoryId) {
      // First notification after arming — just set the baseline.
      await this.watchRepo.advanceHistoryId(state.user_id, newHistoryId);
      return;
    }

    let messageIds: string[];
    try {
      messageIds = await this.collectChangedMessageIds(gmail, startHistoryId);
    } catch (err: any) {
      if (err?.code === 404 || err?.response?.status === 404) {
        // historyId expired (offline too long). Reset cursor; cron backstops.
        logger.warn("[HistoryProcessor] historyId expired, resetting cursor", {
          emailAddress,
          startHistoryId,
        });
        await this.watchRepo.advanceHistoryId(state.user_id, newHistoryId);
        return;
      }
      throw err;
    }

    for (const id of messageIds) {
      await this.handleMessage(gmail, state.user_id, emailAddress, id, replyDetector);
    }

    await this.watchRepo.advanceHistoryId(state.user_id, newHistoryId);
    logger.info("[HistoryProcessor] processed", {
      emailAddress,
      changed: messageIds.length,
      from: startHistoryId,
      to: newHistoryId,
    });
  }

  private async collectChangedMessageIds(
    gmail: gmail_v1.Gmail,
    startHistoryId: string
  ): Promise<string[]> {
    const ids = new Set<string>();
    let pageToken: string | undefined;

    do {
      const res = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        pageToken,
      });
      for (const h of res.data.history ?? []) {
        for (const m of h.messagesAdded ?? []) {
          if (m.message?.id) ids.add(m.message.id);
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return [...ids];
  }

  private async handleMessage(
    gmail: gmail_v1.Gmail,
    userId: string,
    selfAddress: string,
    messageId: string,
    replyDetector: ReplyDetector
  ): Promise<void> {
    let detail;
    try {
      detail = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: [
          "From",
          "To",
          "Subject",
          "X-Failed-Recipients",
          // For exact reply attribution: a reply's In-Reply-To/References name
          // the message id of the email we sent (which we stored on send).
          "In-Reply-To",
          "References",
        ],
      });
    } catch (err: any) {
      // history.list can reference messages that no longer exist (deleted, or a
      // draft that was sent between the history record and our fetch). A 404 here
      // means "nothing to process" — skip it. Letting it throw would abort the
      // whole batch, nack the notification, and loop forever on the dead id.
      if (err?.code === 404 || err?.response?.status === 404) {
        logger.debug("[HistoryProcessor] message gone, skipping", { messageId });
        return;
      }
      throw err;
    }
    const msg = detail.data;

    const classified: ClassifiedMessage | null =
      this.bounceDetector.classify(msg) ?? replyDetector.classify(msg);
    if (!classified || classified.kind === "other") return;

    // Resolve the related recipient: prefer the detector's address, else infer
    // from the thread by finding the original sent message's "To".
    let address = classified.relatedAddress;
    if (!address) {
      address = await this.inferRecipientFromThread(gmail, msg.threadId ?? null, selfAddress);
    }
    if (!address) {
      logger.warn("[HistoryProcessor] could not attribute message", {
        messageId,
        kind: classified.kind,
      });
      return;
    }

    // When the inbound message arrived (Gmail internalDate). Used both as the
    // reply timestamp and as the cutoff for the nearest-time attribution tier.
    const inboundAtIso = msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : new Date().toISOString();

    // Attribute to the exact log: by Gmail thread, then by the RFC822 Message-IDs
    // this reply references, then nearest send at-or-before it arrived.
    const log = await this.inboxRepo.attributeToLog(userId, address, {
      threadId: msg.threadId ?? null,
      referenceMessageIds: this.parseReferenceMessageIds(msg),
      inboundAtIso,
    });
    if (!log) {
      logger.info("[HistoryProcessor] no sent log for address; skipping", { address });
      return;
    }

    if (classified.kind === "bounce") {
      await this.inboxRepo.markBounced(log.id, log.session_id, address);
    } else if (classified.kind === "reply") {
      // Capture a short preview of the reply. `snippet` comes back on the
      // metadata fetch above (no extra call).
      const snippet = (msg.snippet ?? "").trim();
      await this.inboxRepo.markReplied(log.id, address, snippet, inboundAtIso);
    }
  }

  /**
   * Parse the RFC822 Message-IDs a reply references from its In-Reply-To and
   * References headers (each a space-separated list of "<id@host>" tokens).
   * These are matched against the rfc822_message_id we stored on send.
   */
  private parseReferenceMessageIds(msg: gmail_v1.Schema$Message): string[] {
    const headerValue = (name: string): string =>
      msg.payload?.headers
        ?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value ?? "";

    const raw = `${headerValue("In-Reply-To")} ${headerValue("References")}`;
    const ids = raw.match(/<[^>]+>/g) ?? [];
    return [...new Set(ids.map((id) => id.trim()))];
  }

  /** For a bounce/reply in a thread, find the address WE originally sent to. */
  private async inferRecipientFromThread(
    gmail: gmail_v1.Gmail,
    threadId: string | null,
    selfAddress: string
  ): Promise<string | null> {
    if (!threadId) return null;
    let thread;
    try {
      thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "metadata",
        metadataHeaders: ["To", "From"],
      });
    } catch (err: any) {
      if (err?.code === 404 || err?.response?.status === 404) return null;
      throw err;
    }
    for (const m of thread.data.messages ?? []) {
      const labels = m.labelIds ?? [];
      if (!labels.includes("SENT")) continue;
      const to = m.payload?.headers?.find((h) => h.name?.toLowerCase() === "to")?.value ?? "";
      const match = to.match(/<([^>]+)>/);
      const addr = (match ? match[1] : to).trim().toLowerCase();
      if (addr && addr !== selfAddress.toLowerCase() && addr.includes("@")) return addr;
    }
    return null;
  }
}
