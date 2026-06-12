import { Pool, PoolClient } from "pg";

/** A queryable: either the shared pool or a client bound to an open transaction. */
type Queryable = Pool | PoolClient;

export interface SessionStatusRow {
  id: string;
  status: string;
  total_emails: number;
  sent_count: number;
  failed_count: number;
  started_at: Date | null;
  completed_at: Date | null;
}

/**
 * SessionRepository — reads/writes for the email_sessions table.
 *
 * The create() path runs inside the enqueue transaction, so it accepts an
 * optional PoolClient; when omitted it falls back to the pool. Counter updates
 * that happen per-send live in SendJobRepository (kept there so the worker has a
 * narrow surface); this repo owns session creation + status reads.
 */
export class SessionRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a 'queued' session row. Pass the transaction client so it commits
   * atomically with the per-recipient logs and the enqueued jobs.
   */
  async createQueued(
    params: {
      userId: string;
      templateId: string;
      subject: string;
      globalVariables: unknown;
      totalEmails: number;
    },
    tx?: PoolClient
  ): Promise<string> {
    const db: Queryable = tx ?? this.pool;
    const res = await db.query<{ id: string }>(
      `INSERT INTO email_sessions
          (user_id, template_id, subject, global_variables, total_emails, status, started_at)
       VALUES ($1, $2, $3, $4, $5, 'queued', NOW())
       RETURNING id`,
      [
        params.userId,
        params.templateId,
        params.subject,
        JSON.stringify(params.globalVariables),
        params.totalEmails,
      ]
    );
    return res.rows[0].id;
  }

  /** Fetch a session's progress row, scoped to its owner. Null if not found. */
  async getStatusForUser(
    sessionId: string,
    userId: string
  ): Promise<SessionStatusRow | null> {
    const res = await this.pool.query<SessionStatusRow>(
      `SELECT id, status, total_emails, sent_count, failed_count, started_at, completed_at
       FROM email_sessions
       WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    return res.rows[0] ?? null;
  }
}
