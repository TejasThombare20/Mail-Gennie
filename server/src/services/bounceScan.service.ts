/**
 * ============================================================================
 * BOUNCE SCAN SERVICE
 * ============================================================================
 *
 * Scans completed email sessions for bounce/delivery failure notifications
 * by checking Gmail threads for replies from Mail Delivery Subsystem.
 *
 * Flow:
 *   1. Find sessions with scan_status = 'pending'
 *   2. For each session, get all 'sent' email logs
 *   3. For each sent email, search Gmail for the thread
 *   4. Check if the thread contains a bounce from mailer-daemon@googlemail.com
 *   5. Update email_logs status to 'bounced' and adjust session counts
 *   6. Mark session scan_status as 'done'
 *
 * ============================================================================
 */

import { google } from "googleapis";
import { gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { TokenRepository } from "../repository/token.repository";
import { HistoryRepository } from "../repository/history.repository";
import logger from "../utils/logger";

const MAILER_DAEMON = "mailer-daemon@googlemail.com";

/**
 * Broad heuristic to decide whether a "From" header (and optionally a "Subject")
 * indicates a delivery-failure / bounce notification, across mail providers.
 *
 * Catches:
 *   - mailer-daemon@<anything>         (Gmail, Google Workspace, etc.)
 *   - postmaster@<anything>            (Exchange/Outlook, many SMTP servers)
 *   - "Mail Delivery Subsystem"        display name
 *   - "Mail Delivery System"           (Postfix wording)
 *   - "Delivery Status Notification (Failure)"  in the From or Subject
 *   - common bounce/undeliverable wording in the subject
 */
function isBounceSignal(fromHeader: string, subjectHeader = ""): boolean {
  const from = fromHeader.toLowerCase();
  const subject = subjectHeader.toLowerCase();

  // From-header local-parts / display names that signal a daemon
  if (
    from.includes("mailer-daemon@") ||
    from.includes("postmaster@") ||
    from.includes(MAILER_DAEMON) ||
    from.includes("mail delivery subsystem") ||
    from.includes("mail delivery system")
  ) {
    return true;
  }

  // Subject / from wording that signals a failure notification
  const failurePhrases = [
    "delivery status notification (failure)",
    "delivery status notification",
    "undeliverable",
    "undelivered mail returned",
    "returned mail",
    "failure notice",
    "mail delivery failed",
    "address not found",
    "delivery has failed",
  ];

  return failurePhrases.some(
    (phrase) => subject.includes(phrase) || from.includes(phrase)
  );
}

export class BounceScanService {
  constructor(
    private tokenRepository: TokenRepository,
    private historyRepository: HistoryRepository
  ) {}

  /**
   * Build a fresh OAuth2Client per user, with token refresh + probe fallback.
   * Follows the same strategy as fetch-sent-emails.ts:
   *   1. Access token still valid → use directly
   *   2. Access token expired + refresh token → try refresh
   *   3. Refresh fails (invalid_grant) → probe stored access token
   *   4. Probe fails → throw (user must re-auth)
   */
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const userToken = await this.tokenRepository.getUserToken(userId);
    if (!userToken) {
      throw new Error(`No tokens found for user ${userId}`);
    }

    // Fresh client per user — avoids shared credential overwrites
    const oauth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    });

    const isExpired =
      !userToken.token_expiry ||
      new Date(userToken.token_expiry) <= new Date(Date.now() + 5 * 60 * 1000);

    // Step 1: token still valid
    if (!isExpired) {
      logger.info(`[BounceScan] Access token valid for user ${userId}`);
      oauth2Client.setCredentials({
        access_token: userToken.google_token,
        refresh_token: userToken.refresh_token ?? undefined,
      });
      return google.gmail({ version: "v1", auth: oauth2Client });
    }

    // Step 2: try refresh
    logger.info(`[BounceScan] Access token expired for user ${userId}, attempting refresh`);

    if (!userToken.refresh_token) {
      logger.warn(`[BounceScan] No refresh token for user ${userId}, probing stored access token`);
      return this.probeAndReturnGmail(oauth2Client, userToken.google_token, userId);
    }

    try {
      oauth2Client.setCredentials({ refresh_token: userToken.refresh_token });
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Persist new tokens
      await this.tokenRepository.saveUserToken(
        userId,
        credentials.access_token!,
        new Date(credentials.expiry_date!),
        credentials.refresh_token ?? userToken.refresh_token
      );

      logger.info(`[BounceScan] Token refreshed for user ${userId}`);
      return google.gmail({ version: "v1", auth: oauth2Client });
    } catch (refreshErr: any) {
      const isInvalidGrant =
        refreshErr?.message?.includes("invalid_grant") ||
        refreshErr?.response?.data?.error === "invalid_grant";

      if (isInvalidGrant) {
        logger.warn(
          `[BounceScan] Refresh token invalid_grant for user ${userId}, probing stored access token`
        );
        return this.probeAndReturnGmail(oauth2Client, userToken.google_token, userId);
      }
      throw refreshErr;
    }
  }

  /**
   * Last resort: set the stored access token and probe Gmail to check if it still works.
   * Google sometimes accepts tokens past their stated expiry.
   */
  private async probeAndReturnGmail(
    oauth2Client: OAuth2Client,
    accessToken: string,
    userId: string
  ): Promise<gmail_v1.Gmail> {
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    try {
      await gmail.users.getProfile({ userId: "me" });
      logger.info(`[BounceScan] Stored access token still accepted for user ${userId}`);
      return gmail;
    } catch(error) {
      logger.error(`Error probing access token for user ${userId}: ${error}`);
      throw new Error(
        `All tokens invalid for user ${userId}. User must re-authenticate through the app.`
      );
    }
  }

  /**
   * Main entry point: scan all pending sessions for bounces.
   * Returns a summary of what was found.
   */
  async scanPendingSessions(): Promise<{
    sessionsScanned: number;
    totalBounces: number;
    errors: string[];
  }> {
    const summary = { sessionsScanned: 0, totalBounces: 0, errors: [] as string[] };

    const pendingSessions = await this.historyRepository.getPendingScanSessions();

    if (pendingSessions.length === 0) {
      logger.info("[BounceScan] No pending sessions to scan");
      return summary;
    }

    logger.info(`[BounceScan] Found ${pendingSessions.length} pending session(s) to scan`);

    // Group sessions by user_id so we build one Gmail client per user
    const sessionsByUser = new Map<string, typeof pendingSessions>();
    for (const session of pendingSessions) {
      const list = sessionsByUser.get(session.user_id) ?? [];
      list.push(session);
      sessionsByUser.set(session.user_id, list);
    }

    for (const [userId, sessions] of sessionsByUser) {
      let gmail: gmail_v1.Gmail;
      try {
        gmail = await this.getGmailClient(userId);
      } catch (err: any) {
        const msg = `[BounceScan] Failed to get Gmail client for user ${userId}: ${err.message}`;
        logger.error(msg);
        summary.errors.push(msg);
        // Auth failure: keep sessions as 'pending' so they retry after user re-auths
        // Do NOT mark them as 'done'
        continue;
      }

      for (const session of sessions) {
        try {
          await this.historyRepository.updateScanStatus(session.id, "in_progress");

          const bounces = await this.scanSession(gmail, session);
          summary.totalBounces += bounces;
          summary.sessionsScanned++;

          await this.historyRepository.updateScanStatus(session.id, "done");

          logger.info(`[BounceScan] Session ${session.id}: ${bounces} bounce(s) detected`);
        } catch (err: any) {
          const msg = `[BounceScan] Error scanning session ${session.id}: ${err.message}`;
          logger.error(msg);
          summary.errors.push(msg);
          // Scan error on individual session: mark done to prevent infinite retries
          await this.historyRepository.updateScanStatus(session.id, "done");
        }
      }
    }

    logger.info("[BounceScan] Scan complete", summary);
    return summary;
  }

  /**
   * Public wrapper to build a Gmail client for a given user.
   * Used by the per-address verification script.
   */
  async getGmailClientForUser(userId: string): Promise<gmail_v1.Gmail> {
    return this.getGmailClient(userId);
  }

  /**
   * Verify a single address directly against Gmail (no session/time window).
   * Searches for ANY thread to the address and checks it for a bounce.
   *
   * Returns:
   *   'failed'        — a bounce/failure message exists in the thread to this address
   *   'valid'         — a thread exists and contains no bounce (delivered)
   *   'not_verified'  — no Gmail thread found for the address (can't conclude)
   */
  async verifyAddressValidity(
    gmail: gmail_v1.Gmail,
    email: string
  ): Promise<"valid" | "failed" | "not_verified"> {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: `to:${email}`,
      maxResults: 10,
    });

    const messages = listRes.data.messages ?? [];
    if (messages.length === 0) {
      // No thread at all → cannot conclude delivery; leave as not_verified.
      return "not_verified";
    }

    const checkedThreads = new Set<string>();
    for (const msg of messages) {
      const msgDetail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["To", "From", "Subject"],
      });

      const fromHeader = msgDetail.data.payload?.headers
        ?.find((h) => h.name?.toLowerCase() === "from")
        ?.value?.toLowerCase() ?? "";
      const subjectHeader = msgDetail.data.payload?.headers
        ?.find((h) => h.name?.toLowerCase() === "subject")
        ?.value ?? "";

      if (isBounceSignal(fromHeader, subjectHeader)) return "failed";

      const threadId = msgDetail.data.threadId;
      if (threadId && !checkedThreads.has(threadId)) {
        checkedThreads.add(threadId);
        if (await this.threadHasBounce(gmail, threadId)) return "failed";
      }
    }

    // A thread exists and no bounce was found → the address delivered.
    return "valid";
  }

  /**
   * Scan a single session: check each sent email for bounce replies.
   * Returns the number of bounces found.
   */
  private async scanSession(
    gmail: gmail_v1.Gmail,
    session: {
      id: string;
      started_at: Date;
      completed_at: Date | null;
    }
  ): Promise<number> {
    const sentLogs = await this.historyRepository.getSentEmailLogsForSession(session.id);

    if (sentLogs.length === 0) {
      return 0;
    }

    // Session time window: from started_at to completed_at (or +1 hour if no completed_at)
    const sessionStart = new Date(session.started_at);
    const sessionEnd = session.completed_at
      ? new Date(session.completed_at)
      : new Date(sessionStart.getTime() + 60 * 60 * 1000);

    // Add buffer: bounces can arrive minutes after session ends
    const searchEnd = new Date(sessionEnd.getTime() + 30 * 60 * 1000);

    let bouncesFound = 0;

    for (const log of sentLogs) {
      try {
        const isBounced = await this.checkEmailBounce(
          gmail,
          log.recipient_email,
          sessionStart,
          searchEnd,
          log.sent_at
        );

        if (isBounced) {
          await this.historyRepository.updateEmailLogStatus(log.id, "bounced");
          // Mark this address as a confirmed delivery failure.
          await this.historyRepository.updateRecordValidity(
            log.recipient_email,
            "failed"
          );
          bouncesFound++;
          logger.info(`[BounceScan] BOUNCED: ${log.recipient_email} (log ${log.id})`);
        } else {
          // No bounce found in the thread → the address delivered successfully.
          await this.historyRepository.updateRecordValidity(
            log.recipient_email,
            "valid"
          );
        }
      } catch (err: any) {
        logger.warn(
          `[BounceScan] Failed to check bounce for ${log.recipient_email} in session ${session.id}: ${err.message}`
        );
      }
    }

    // Update session counts if we found bounces
    if (bouncesFound > 0) {
      await this.historyRepository.incrementFailedCount(session.id, bouncesFound);
    }

    return bouncesFound;
  }

  /**
   * Check if a specific email to `recipientEmail` has a bounce reply.
   *
   * Strategy:
   *   1. Search Gmail for the sent message to this recipient within the time window
   *   2. Get the thread of each matching message
   *   3. Check if any message in the thread is from mailer-daemon@googlemail.com
   *
   * NOTE: We search without `in:sent` label filter because the bounce reply
   * from mailer-daemon lives in the same thread but not in SENT label.
   * Gmail `to:` with epoch timestamps is enough to find the original sent message.
   */
  private async checkEmailBounce(
    gmail: gmail_v1.Gmail,
    recipientEmail: string,
    sessionStart: Date,
    searchEnd: Date,
    sentAt: Date
  ): Promise<boolean> {
    // Gmail search: find our sent email to this recipient in the time window
    const afterEpoch = Math.floor(sessionStart.getTime() / 1000);
    const beforeEpoch = Math.floor(searchEnd.getTime() / 1000);

    // Use `to:` + time range. No `in:sent` — we want the full thread including bounce replies.
    const query = `to:${recipientEmail} after:${afterEpoch} before:${beforeEpoch}`;

    logger.info(`[BounceScan] Searching Gmail: "${query}" for ${recipientEmail}`);

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 10,
    });

    const messages = listRes.data.messages ?? [];

    if (messages.length === 0) {
      logger.info(`[BounceScan] No Gmail messages found for ${recipientEmail} in window`);
      return false;
    }

    logger.info(`[BounceScan] Found ${messages.length} message(s) for ${recipientEmail}`);

    // Check each matching message's thread for bounce replies
    const checkedThreads = new Set<string>();

    for (const msg of messages) {
      const msgDetail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["To", "From", "Date", "Subject"],
      });

      const threadId = msgDetail.data.threadId;
      if (!threadId || checkedThreads.has(threadId)) continue;
      checkedThreads.add(threadId);

      // Check: is this message itself the bounce? (mailer-daemon reply shows up in search too)
      const fromHeader = msgDetail.data.payload?.headers
        ?.find((h) => h.name?.toLowerCase() === "from")
        ?.value?.toLowerCase() ?? "";
      const subjectHeader = msgDetail.data.payload?.headers
        ?.find((h) => h.name?.toLowerCase() === "subject")
        ?.value ?? "";

      if (isBounceSignal(fromHeader, subjectHeader)) {
        logger.info(`[BounceScan] Direct bounce message found for ${recipientEmail}`);
        return true;
      }

      // Verify this message was sent to our target recipient
      const toHeader = msgDetail.data.payload?.headers
        ?.find((h) => h.name?.toLowerCase() === "to")
        ?.value?.toLowerCase() ?? "";

      if (!toHeader.includes(recipientEmail.toLowerCase())) continue;

      // Fetch the full thread and look for mailer-daemon bounce
      const hasBounce = await this.threadHasBounce(gmail, threadId);
      if (hasBounce) {
        logger.info(`[BounceScan] Bounce found in thread ${threadId} for ${recipientEmail}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a Gmail thread contains a bounce notification from
   * Mail Delivery Subsystem (mailer-daemon@googlemail.com).
   *
   * No time window check here — if a bounce exists in the same thread as our
   * sent email, the email bounced regardless of exact bounce timestamp.
   */
  private async threadHasBounce(
    gmail: gmail_v1.Gmail,
    threadId: string
  ): Promise<boolean> {
    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["From", "Subject"],
    });

    const threadMessages = threadRes.data.messages ?? [];

    for (const msg of threadMessages) {
      const headers = msg.payload?.headers ?? [];
      const fromHeader = headers
        .find((h) => h.name?.toLowerCase() === "from")
        ?.value?.toLowerCase() ?? "";
      const subjectHeader = headers
        .find((h) => h.name?.toLowerCase() === "subject")
        ?.value ?? "";

      if (isBounceSignal(fromHeader, subjectHeader)) {
        return true;
      }
    }

    return false;
  }
}
