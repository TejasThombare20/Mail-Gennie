import { Pool, PoolClient } from "pg";

/** A queryable: either the shared pool or a client bound to an open transaction. */
type Queryable = Pool | PoolClient;

/**
 * EmailLogRepository — the email_logs writes/reads that aren't the per-send
 * status transitions (those live in SendJobRepository, kept narrow for the
 * worker). This owns creating the 'queued' row at enqueue time and the
 * idempotency status probe the worker runs before sending.
 */
export class EmailLogRepository {
  constructor(private pool: Pool) {}

  /**
   * Insert a per-recipient 'queued' log row. Pass the transaction client so it
   * commits atomically with the session row and the enqueued job. Returns the
   * new log id (used as the job's payload key + idempotency key).
   */
  async createQueued(
    params: {
      sessionId: string;
      userId: string;
      templateId: string;
      recipientEmail: string;
      localVariables: unknown;
      globalVariables: unknown;
      subject: string;
    },
    tx?: PoolClient
  ): Promise<number> {
    const db: Queryable = tx ?? this.pool;
    const res = await db.query<{ id: number }>(
      `INSERT INTO email_logs
          (session_id, user_id, template_id, recipient_email, local_variables, global_variables, subject, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'queued')
       RETURNING id`,
      [
        params.sessionId,
        params.userId,
        params.templateId,
        params.recipientEmail,
        JSON.stringify(params.localVariables),
        JSON.stringify(params.globalVariables),
        params.subject,
      ]
    );
    return res.rows[0].id;
  }

  /** Current status of a log row (worker idempotency probe). Null if missing. */
  async getStatus(logId: number): Promise<string | null> {
    const res = await this.pool.query<{ status: string }>(
      `SELECT status FROM email_logs WHERE id = $1`,
      [logId]
    );
    return res.rows[0]?.status ?? null;
  }
}
