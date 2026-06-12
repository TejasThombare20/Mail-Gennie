import { gmail_v1 } from "googleapis";
import { GmailClientFactory, TokenRepository, getPool } from "@app/shared";

/** Result of a Gmail send: HTTP status plus the ids identifying the message. */
export interface SendResult {
  status: number;
  /** Gmail INTERNAL message id from the send response (.data.id). */
  messageId: string | null;
  /** Gmail INTERNAL thread id the sent message belongs to (.data.threadId). */
  threadId: string | null;
  /**
   * RFC822 "Message-ID" HEADER of the sent message (e.g. "<CAB...@mail.gmail.com>").
   * Distinct from messageId. This is what a reply's In-Reply-To/References
   * headers contain, so it's what enables exact reply attribution. Requires one
   * extra metadata fetch after send; null if that lookup fails.
   */
  rfc822MessageId: string | null;
}

/**
 * GmailSender — wraps the shared GmailClientFactory and exposes a single
 * `send(raw)` operation. Caches one authenticated client per user for the
 * lifetime of the process so a burst of jobs for the same user reuses the
 * client (the factory still handles refresh when a token is near expiry).
 */
export class GmailSender {
  private static instance: GmailSender;
  private readonly factory: GmailClientFactory;
  private readonly clients = new Map<string, gmail_v1.Gmail>();

  private constructor() {
    this.factory = new GmailClientFactory(new TokenRepository(getPool()));
  }

  static getInstance(): GmailSender {
    if (!GmailSender.instance) {
      GmailSender.instance = new GmailSender();
    }
    return GmailSender.instance;
  }

  /**
   * Send a base64url-encoded raw MIME message as the given user. Returns the
   * HTTP status plus Gmail's assigned message/thread ids — the worker persists
   * these on the email_log so inbound replies can be attributed back exactly.
   */
  async send(userId: string, encodedMessage: string): Promise<SendResult> {
    const gmail = await this.getClient(userId);
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    const messageId = response.data?.id ?? null;
    const threadId = response.data?.threadId ?? null;

    // The send response carries the internal id/threadId but NOT the RFC822
    // Message-ID header (which replies reference). Fetch it with a metadata get.
    // Best-effort: if it fails we still return; tier-1 (threadId) attribution
    // and the nearest-time fallback don't depend on it.
    let rfc822MessageId: string | null = null;
    if (messageId) {
      rfc822MessageId = await this.fetchRfc822MessageId(gmail, messageId);
    }

    return {
      status: response.status ?? 0,
      messageId,
      threadId,
      rfc822MessageId,
    };
  }

  /** Read the sent message's RFC822 "Message-ID" header (best-effort). */
  private async fetchRfc822MessageId(
    gmail: gmail_v1.Gmail,
    messageId: string
  ): Promise<string | null> {
    try {
      const meta = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["Message-Id"],
      });
      const header = meta.data.payload?.headers?.find(
        (h) => h.name?.toLowerCase() === "message-id"
      );
      return header?.value ?? null;
    } catch {
      return null;
    }
  }

  private async getClient(userId: string): Promise<gmail_v1.Gmail> {
    const cached = this.clients.get(userId);
    if (cached) return cached;
    const client = await this.factory.createForUser(userId);
    this.clients.set(userId, client);
    return client;
  }

  /** Drop a cached client (e.g. after an auth error) so the next send re-auths. */
  invalidate(userId: string): void {
    this.clients.delete(userId);
  }
}
