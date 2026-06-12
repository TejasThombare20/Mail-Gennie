import { Pool } from "pg";
import logger from "../utils/logger";

/**
 * SendJobRepository — the narrow set of writes the queue worker performs while
 * sending one email. Deliberately small (not the full HistoryRepository): the
 * worker only needs to update a log's status, bump session counters atomically,
 * close a session when its last job finishes, and upsert the delivery record.
 *
 * Counters are incremented per-job (each job runs independently in the queue),
 * unlike the old in-process loop that computed totals at the end.
 */
export class SendJobRepository {
  constructor(private pool: Pool) {}

  async updateEmailLogStatus(logId: number, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE email_logs SET status = $1, last_updated = NOW() WHERE id = $2`,
      [status, logId]
    );
  }

  /**
   * Mark a log 'sent' AND record the ids identifying the message we just sent.
   * The pubsub-service later uses these to attribute an inbound reply back to
   * this exact log:
   *   - thread_id         -> reply shares our Gmail threadId (tier 1)
   *   - rfc822_message_id -> reply's In-Reply-To/References names it (tier 2)
   * Also stamps sent_at so the nearest-time fallback (for rows without ids) has
   * an accurate send timestamp.
   */
  async markSent(
    logId: number,
    ids: {
      messageId: string | null;
      threadId: string | null;
      rfc822MessageId: string | null;
    }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE email_logs
         SET status            = 'sent',
             gmail_message_id  = $2,
             thread_id         = $3,
             rfc822_message_id = $4,
             sent_at           = NOW(),
             last_updated      = NOW()
       WHERE id = $1`,
      [logId, ids.messageId, ids.threadId, ids.rfc822MessageId]
    );
  }

  /**
   * Atomically bump a session's sent/failed counters by one and, when the sum of
   * sent+failed reaches total_emails, mark the session completed. Returns the
   * fresh counts so the caller can log progress.
   */
  async recordSendResult(
    sessionId: string,
    outcome: "sent" | "failed"
  ): Promise<{ sent_count: number; failed_count: number; total_emails: number } | null> {
    const sentDelta = outcome === "sent" ? 1 : 0;
    const failedDelta = outcome === "failed" ? 1 : 0;

    const result = await this.pool.query(
      `UPDATE email_sessions
         SET sent_count   = sent_count + $2,
             failed_count = failed_count + $3,
             status = CASE
               WHEN (sent_count + $2) + (failed_count + $3) >= total_emails
                 THEN 'completed'
               ELSE status
             END,
             completed_at = CASE
               WHEN (sent_count + $2) + (failed_count + $3) >= total_emails
                 THEN NOW()
               ELSE completed_at
             END
       WHERE id = $1
       RETURNING sent_count, failed_count, total_emails`,
      [sessionId, sentDelta, failedDelta]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Upsert the sent_email_records delivery row. is_valid resets to
   * 'not_verified' so the bounce/reply pipeline re-checks the address.
   */
  async upsertSentRecord(
    firstName: string,
    email: string,
    companyName: string | null
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO sent_email_records (first_name, email, company_name, sent_at, type, is_valid)
         VALUES ($1, $2, $3, NOW(), 'sent', 'not_verified')
         ON CONFLICT (email) DO UPDATE
           SET type     = 'sent',
               sent_at  = EXCLUDED.sent_at,
               is_valid = 'not_verified'`,
        [firstName, email, companyName]
      );
    } catch (error) {
      logger.error("Failed to upsert sent_email_record", { email, error });
    }
  }
}
