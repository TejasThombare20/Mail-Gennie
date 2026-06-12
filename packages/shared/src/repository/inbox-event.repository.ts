import { Pool } from "pg";
import logger from "../utils/logger";

/**
 * InboxEventRepository — writes the pubsub-service makes when it detects an
 * inbound event (a bounce or a human reply) for a previously sent email.
 *
 * Bounce  -> mark the email_log 'bounced', mark the address 'failed', bump the
 *            session failed count.
 * Reply   -> append a { response_message, responded_at, source:'auto' } entry to
 *            user_actions.mail_replied[], mark the address 'valid' (a human
 *            replying proves delivery).
 */
export class InboxEventRepository {
  constructor(private pool: Pool) {}

  /**
   * Attribute an inbound reply/bounce back to the email_log it belongs to.
   *
   * Tiered, most-precise-first:
   *   1. EXACT by thread — the inbound message shares the Gmail threadId of a
   *      message we sent. One Gmail thread == one conversation, so this is
   *      unambiguous for any email sent after the message/thread-id migration.
   *   2. EXACT by RFC822 Message-ID — the reply's In-Reply-To / References
   *      headers name the RFC822 Message-ID header of the email we sent (stored
   *      as rfc822_message_id). Covers replies Gmail didn't group into the same
   *      thread. NOTE: this matches the RFC822 header id, NOT gmail_message_id.
   *   3. NEAREST send before the reply — fallback for rows predating the ids
   *      (thread_id / rfc822_message_id are NULL): the most recent send to this
   *      recipient AT OR BEFORE the inbound message arrived. This correctly
   *      credits the session the reply actually answers when the same recipient
   *      was emailed more than once, instead of always taking the latest send.
   *
   * @param userId         the platform user whose mailbox received the message
   * @param recipientEmail the address we originally sent to (the replier/bounce target)
   * @param ctx.threadId   the inbound message's Gmail threadId, if any
   * @param ctx.referenceMessageIds  RFC822 Message-IDs parsed from In-Reply-To/References
   * @param ctx.inboundAtIso the inbound message's arrival time (Gmail internalDate)
   */
  async attributeToLog(
    userId: string,
    recipientEmail: string,
    ctx: {
      threadId?: string | null;
      referenceMessageIds?: string[];
      inboundAtIso?: string | null;
    }
  ): Promise<{ id: number; session_id: string } | null> {
    // 1. Exact match by Gmail thread id.
    if (ctx.threadId) {
      const byThread = await this.pool.query(
        `SELECT id, session_id
         FROM email_logs
         WHERE user_id = $1 AND thread_id = $2 AND status = 'sent'
         ORDER BY sent_at DESC
         LIMIT 1`,
        [userId, ctx.threadId]
      );
      if (byThread.rows[0]) return byThread.rows[0];
    }

    // 2. Exact match by RFC822 Message-ID referenced in the reply headers.
    if (ctx.referenceMessageIds && ctx.referenceMessageIds.length > 0) {
      const byMessageId = await this.pool.query(
        `SELECT id, session_id
         FROM email_logs
         WHERE user_id = $1
           AND rfc822_message_id = ANY($2::text[])
           AND status = 'sent'
         ORDER BY sent_at DESC
         LIMIT 1`,
        [userId, ctx.referenceMessageIds]
      );
      if (byMessageId.rows[0]) return byMessageId.rows[0];
    }

    // 3. Fallback: nearest send to this recipient AT OR BEFORE the inbound time.
    //    If we don't know the inbound time, fall back to "latest send" (NOW()).
    const cutoff = ctx.inboundAtIso ?? new Date().toISOString();
    const byTime = await this.pool.query(
      `SELECT id, session_id
       FROM email_logs
       WHERE user_id = $1
         AND recipient_email = $2
         AND status = 'sent'
         AND sent_at <= $3
       ORDER BY sent_at DESC
       LIMIT 1`,
      [userId, recipientEmail, cutoff]
    );
    return byTime.rows[0] ?? null;
  }

  async markBounced(logId: number, sessionId: string, recipientEmail: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE email_logs SET status = 'bounced', last_updated = NOW() WHERE id = $1`,
        [logId]
      );
      await client.query(
        `UPDATE sent_email_records SET is_valid = 'failed' WHERE email = $1`,
        [recipientEmail]
      );
      await client.query(
        `UPDATE email_sessions SET failed_count = failed_count + 1 WHERE id = $1`,
        [sessionId]
      );
      await client.query("COMMIT");
      logger.info("[InboxEvent] marked bounced", { logId, recipientEmail });
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[InboxEvent] markBounced failed", { logId, error: (err as Error).message });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Append an auto-detected reply to email_logs.user_actions.mail_replied[].
   *
   * Dedupe: skip if an entry with source='auto' AND the same responded_at already
   * exists (Pub/Sub can redeliver; we ack only after success but stay idempotent).
   * A human reply proves delivery, so we also mark the address 'valid'.
   */
  async markReplied(
    logId: number,
    recipientEmail: string,
    responseMessage: string,
    respondedAtIso: string
  ): Promise<void> {
    const entry = {
      response_message: responseMessage,
      responded_at: respondedAtIso,
      source: "auto" as const,
    };
    // Probe used by the @> containment check to avoid duplicate auto entries.
    const dupeProbe = JSON.stringify([
      { source: "auto", responded_at: respondedAtIso },
    ]);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE email_logs
         SET user_actions = jsonb_set(
               COALESCE(user_actions, '{}'::jsonb),
               '{mail_replied}',
               COALESCE(user_actions->'mail_replied', '[]'::jsonb) || $2::jsonb
             ),
             last_updated = NOW()
         WHERE id = $1
           AND NOT COALESCE(user_actions->'mail_replied', '[]'::jsonb) @> $3::jsonb`,
        [logId, JSON.stringify([entry]), dupeProbe]
      );
      await client.query(
        `UPDATE sent_email_records SET is_valid = 'valid' WHERE email = $1`,
        [recipientEmail]
      );
      await client.query("COMMIT");
      logger.info("[InboxEvent] marked replied", { logId, recipientEmail });
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[InboxEvent] markReplied failed", { logId, error: (err as Error).message });
      throw err;
    } finally {
      client.release();
    }
  }
}
