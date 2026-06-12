import { Pool } from "pg";
import { EmailSession, EmailLogEntry } from "../types/historyLogs.types";
import logger from "../utils/logger";

export class HistoryRepository {
  constructor(private pool: Pool) {}

  // ── Session methods ──────────────────────────────────────────────

  async createSession(data: {
    user_id: string;
    template_id: string;
    subject: string;
    global_variables: Record<string, any>;
    total_emails: number;
  }): Promise<{ id: string }> {
    const result = await this.pool.query(
      `INSERT INTO email_sessions
          (user_id, template_id, subject, global_variables, total_emails, status, started_at)
       VALUES ($1, $2, $3, $4, $5, 'in_progress', NOW())
       RETURNING id`,
      [
        data.user_id,
        data.template_id,
        data.subject,
        JSON.stringify(data.global_variables),
        data.total_emails,
      ]
    );
    return result.rows[0];
  }

  async updateSessionStatus(
    sessionId: string,
    status: string,
    sentCount: number,
    failedCount: number
  ) {
    await this.pool.query(
      `UPDATE email_sessions
       SET status = $1,
           sent_count = $2,
           failed_count = $3,
           completed_at = NOW()
       WHERE id = $4`,
      [status, sentCount, failedCount, sessionId]
    );
  }

  // ── Per-recipient email log methods ──────────────────────────────

  async createEmailLog(data: {
    session_id: string;
    user_id: string;
    template_id: string;
    recipient_email: string;
    local_variables: Record<string, any>;
    global_variables: Record<string, any>;
    subject: string;
    status: string;
  }): Promise<{ id: number }> {
    const result = await this.pool.query(
      `INSERT INTO email_logs
          (session_id, user_id, template_id, recipient_email, local_variables, global_variables, subject, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        data.session_id,
        data.user_id,
        data.template_id,
        data.recipient_email,
        JSON.stringify(data.local_variables),
        JSON.stringify(data.global_variables),
        data.subject,
        data.status,
      ]
    );
    return result.rows[0];
  }

  async updateEmailLogStatus(logId: number, status: string) {
    await this.pool.query(
      `UPDATE email_logs
       SET status = $1, last_updated = NOW()
       WHERE id = $2`,
      [status, logId]
    );
  }

  // ── Query methods ────────────────────────────────────────────────

  async getUserSessions(
    user_id: string,
    last_started_at: string | null = null
  ): Promise<EmailSession[] | null> {
    try {
      // Fetch sessions with template name
      const sessionQuery = `
        SELECT
            es.id,
            es.user_id,
            es.template_id,
            t.name AS template_name,
            es.subject,
            es.global_variables,
            es.total_emails,
            es.sent_count,
            es.failed_count,
            es.status,
            es.started_at,
            es.completed_at,
            es.created_at
        FROM email_sessions es
        LEFT JOIN templates t ON es.template_id = t.id
        WHERE es.user_id = $1
        AND ($2::timestamp IS NULL OR es.started_at < $2)
        ORDER BY es.started_at DESC
        LIMIT 10;
      `;
      const values = [
        user_id,
        last_started_at ? new Date(last_started_at).toISOString() : null,
      ];
      const sessionResult = await this.pool.query(sessionQuery, values);
      const sessions: EmailSession[] = sessionResult.rows;

      if (sessions.length === 0) return sessions;

      // Fetch email logs for all these sessions in one query
      const sessionIds = sessions.map((s) => s.id);
      const logsResult = await this.pool.query(
        `SELECT id, session_id, recipient_email, local_variables, status, sent_at, last_updated,
                COALESCE(user_actions, '{}'::jsonb) AS user_actions
         FROM email_logs
         WHERE session_id = ANY($1)
         ORDER BY sent_at ASC`,
        [sessionIds]
      );

      // Group logs by session_id
      const logsBySession: Record<string, EmailLogEntry[]> = {};
      for (const log of logsResult.rows) {
        if (!logsBySession[log.session_id]) {
          logsBySession[log.session_id] = [];
        }
        logsBySession[log.session_id].push(log);
      }

      // Attach logs to sessions
      for (const session of sessions) {
        session.email_logs = logsBySession[session.id] || [];
      }

      return sessions;
    } catch (error) {
      logger.error("Error while fetching user email sessions", { error });
      return null;
    }
  }

  // ── Dashboard stats ──────────────────────────────────────────────

  async getDashboardStats(user_id: string): Promise<{
    summary: {
      total_sessions: number;
      total_emails_sent: number;
      total_emails_failed: number;
      completed_sessions: number;
      failed_sessions: number;
      in_progress_sessions: number;
    };
    sessions: Array<{
      id: string;
      subject: string;
      template_name: string | null;
      status: string;
      total_emails: number;
      sent_count: number;
      failed_count: number;
      started_at: Date;
      completed_at: Date | null;
      created_at: Date;
      duration_seconds: number | null;
      recipient_companies: string[];
    }>;
  } | null> {
    try {
      // Summary stats
      const summaryResult = await this.pool.query(
        `SELECT
           COUNT(*)::int AS total_sessions,
           COALESCE(SUM(sent_count), 0)::int AS total_emails_sent,
           COALESCE(SUM(failed_count), 0)::int AS total_emails_failed,
           COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_sessions,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_sessions,
           COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_sessions
         FROM email_sessions
         WHERE user_id = $1`,
        [user_id]
      );

      // Per-session details with template name and recipient companies
      const sessionsResult = await this.pool.query(
        `SELECT
           es.id,
           es.subject,
           t.name AS template_name,
           es.status,
           es.total_emails,
           es.sent_count,
           es.failed_count,
           es.started_at,
           es.completed_at,
           es.created_at,
           CASE
             WHEN es.completed_at IS NOT NULL AND es.started_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (es.completed_at - es.started_at))::int
             ELSE NULL
           END AS duration_seconds,
           COALESCE(
             ARRAY(
               SELECT DISTINCT ser.company_name
               FROM email_logs el
               JOIN sent_email_records ser ON ser.email = el.recipient_email
               WHERE el.session_id = es.id
                 AND ser.company_name IS NOT NULL
                 AND ser.company_name != ''
             ),
             '{}'
           ) AS recipient_companies
         FROM email_sessions es
         LEFT JOIN templates t ON es.template_id = t.id
         WHERE es.user_id = $1
         ORDER BY es.started_at DESC`,
        [user_id]
      );

      return {
        summary: summaryResult.rows[0],
        sessions: sessionsResult.rows,
      };
    } catch (error) {
      logger.error("Error fetching dashboard stats", { error });
      return null;
    }
  }

  // ── Bar-graph aggregation (company + date) ────────────────────────

  /**
   * Aggregates emails per (company, date) for the dashboard bar graph.
   *
   * Requirement: when the same company is mailed on the same date across
   * multiple sessions (e.g. template 1 and template 2 both to "Google" on
   * 2026-06-11 create separate sessions), they must collapse into a SINGLE
   * bar — sent/failed counts summed.
   *
   * A session's sent/failed counts are attributed to each distinct company in
   * that session. Sessions with no resolved company are bucketed under
   * "(unknown)" so the totals still line up.
   *
   * Returned in chronological order (oldest first) so the UI can show the most
   * recent N by default and let the user scroll left for older bars.
   */
  async getEmailsByCompanyDate(user_id: string): Promise<
    Array<{
      day: string; // YYYY-MM-DD
      company: string;
      sent: number;
      failed: number;
    }>
  > {
    try {
      const result = await this.pool.query(
        `WITH session_companies AS (
           SELECT
             es.id AS session_id,
             to_char(es.started_at, 'YYYY-MM-DD') AS day,
             es.sent_count,
             es.failed_count,
             COALESCE(
               NULLIF(
                 ARRAY(
                   SELECT DISTINCT ser.company_name
                   FROM email_logs el
                   JOIN sent_email_records ser ON ser.email = el.recipient_email
                   WHERE el.session_id = es.id
                     AND ser.company_name IS NOT NULL
                     AND ser.company_name != ''
                 ),
                 '{}'
               ),
               ARRAY['(unknown)']
             ) AS companies
           FROM email_sessions es
           WHERE es.user_id = $1
         )
         SELECT
           day,
           company,
           SUM(sent_count)::int AS sent,
           SUM(failed_count)::int AS failed
         FROM session_companies sc, unnest(sc.companies) AS company
         GROUP BY day, company
         ORDER BY day ASC, company ASC`,
        [user_id]
      );
      return result.rows;
    } catch (error) {
      logger.error("Error aggregating emails by company/date", { error });
      return [];
    }
  }

  // ── Paginated dashboard sessions (table) ──────────────────────────

  /**
   * Returns a single page of session details for the dashboard table, with
   * server-side search (over subject, template name, company names) and
   * optional status / company filters applied across the FULL dataset.
   *
   * Also returns the total row count (for the filtered set) and the list of
   * distinct statuses & companies available, so the UI can build filter menus.
   */
  async getDashboardSessionsPaginated(
    user_id: string,
    opts: {
      page: number;
      pageSize: number;
      search?: string | null;
      status?: string | null;
      company?: string | null;
    }
  ): Promise<{
    sessions: Array<{
      id: string;
      template_name: string | null;
      status: string;
      total_emails: number;
      sent_count: number;
      failed_count: number;
      started_at: Date;
      completed_at: Date | null;
      created_at: Date;
      duration_seconds: number | null;
      actions: Record<string, any>;
      recipient_companies: string[];
    }>;
    total: number;
    page: number;
    pageSize: number;
    filters: { statuses: string[]; companies: string[] };
  } | null> {
    try {
      const page = Math.max(1, Math.floor(opts.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize) || 10));
      const offset = (page - 1) * pageSize;

      const search = opts.search?.trim() || null;
      const status = opts.status?.trim() || null;
      const company = opts.company?.trim() || null;

      // A reusable CTE that resolves each session's company list once.
      // Filtering by company / search-over-company both rely on it.
      const baseCte = `
        WITH session_companies AS (
          SELECT
            es.id AS session_id,
            COALESCE(
              ARRAY(
                SELECT DISTINCT ser.company_name
                FROM email_logs el
                JOIN sent_email_records ser ON ser.email = el.recipient_email
                WHERE el.session_id = es.id
                  AND ser.company_name IS NOT NULL
                  AND ser.company_name != ''
              ),
              '{}'
            ) AS companies
          FROM email_sessions es
          WHERE es.user_id = $1
        )
      `;

      // Build dynamic WHERE clause + params (shared between count & page query).
      const params: any[] = [user_id];
      const where: string[] = ["es.user_id = $1"];

      if (status) {
        params.push(status);
        where.push(`es.status = $${params.length}`);
      }

      if (company) {
        params.push(company);
        where.push(`$${params.length} = ANY(sc.companies)`);
      }

      if (search) {
        params.push(`%${search}%`);
        const p = `$${params.length}`;
        where.push(`(
          es.subject ILIKE ${p}
          OR t.name ILIKE ${p}
          OR EXISTS (
            SELECT 1 FROM unnest(sc.companies) AS c WHERE c ILIKE ${p}
          )
        )`);
      }

      const whereSql = where.join(" AND ");

      // Total count for the filtered set.
      const countResult = await this.pool.query(
        `${baseCte}
         SELECT COUNT(*)::int AS total
         FROM email_sessions es
         LEFT JOIN templates t ON es.template_id = t.id
         JOIN session_companies sc ON sc.session_id = es.id
         WHERE ${whereSql}`,
        params
      );
      const total = countResult.rows[0]?.total ?? 0;

      // The page itself.
      const pageParams = [...params, pageSize, offset];
      const sessionsResult = await this.pool.query(
        `${baseCte}
         SELECT
           es.id,
           t.name AS template_name,
           es.status,
           es.total_emails,
           es.sent_count,
           es.failed_count,
           es.started_at,
           es.completed_at,
           es.created_at,
           CASE
             WHEN es.completed_at IS NOT NULL AND es.started_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (es.completed_at - es.started_at))::int
             ELSE NULL
           END AS duration_seconds,
           COALESCE(es.actions, '{}'::jsonb) AS actions,
           sc.companies AS recipient_companies
         FROM email_sessions es
         LEFT JOIN templates t ON es.template_id = t.id
         JOIN session_companies sc ON sc.session_id = es.id
         WHERE ${whereSql}
         ORDER BY es.started_at DESC
         LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
        pageParams
      );

      // Distinct statuses & companies for the filter menus (unfiltered, for this user).
      const statusesResult = await this.pool.query(
        `SELECT DISTINCT status FROM email_sessions WHERE user_id = $1 AND status IS NOT NULL ORDER BY status`,
        [user_id]
      );
      const companiesResult = await this.pool.query(
        `SELECT DISTINCT ser.company_name AS company
         FROM email_logs el
         JOIN email_sessions es ON es.id = el.session_id
         JOIN sent_email_records ser ON ser.email = el.recipient_email
         WHERE es.user_id = $1
           AND ser.company_name IS NOT NULL
           AND ser.company_name != ''
         ORDER BY company`,
        [user_id]
      );

      return {
        sessions: sessionsResult.rows,
        total,
        page,
        pageSize,
        filters: {
          statuses: statusesResult.rows.map((r) => r.status),
          companies: companiesResult.rows.map((r) => r.company),
        },
      };
    } catch (error) {
      logger.error("Error fetching paginated dashboard sessions", { error });
      return null;
    }
  }

  // ── Outreach / user-action methods ────────────────────────────────

  /**
   * Fetch a single session (with template name + resolved companies) plus its
   * recipients, scoped to the owning user. Used to pre-fill the outreach form
   * and to populate the recipient <Select> on the History "who responded" form.
   */
  async getSessionForOutreach(
    sessionId: string,
    user_id: string
  ): Promise<{
    id: string;
    subject: string;
    template_name: string | null;
    status: string;
    started_at: Date;
    global_variables: any;
    actions: any;
    recipient_companies: string[];
    recipients: Array<{
      id: number;
      recipient_email: string;
      status: string;
      user_actions: Record<string, any>;
    }>;
  } | null> {
    const sessionRes = await this.pool.query(
      `SELECT
         es.id,
         es.subject,
         t.name AS template_name,
         es.status,
         es.started_at,
         es.global_variables,
         COALESCE(es.actions, '{}'::jsonb) AS actions,
         COALESCE(
           ARRAY(
             SELECT DISTINCT ser.company_name
             FROM email_logs el
             JOIN sent_email_records ser ON ser.email = el.recipient_email
             WHERE el.session_id = es.id
               AND ser.company_name IS NOT NULL
               AND ser.company_name != ''
           ),
           '{}'
         ) AS recipient_companies
       FROM email_sessions es
       LEFT JOIN templates t ON es.template_id = t.id
       WHERE es.id = $1 AND es.user_id = $2`,
      [sessionId, user_id]
    );

    if (sessionRes.rowCount === 0) return null;

    const recipientsRes = await this.pool.query(
      `SELECT id, recipient_email, status, COALESCE(user_actions, '{}'::jsonb) AS user_actions
         FROM email_logs
        WHERE session_id = $1
        ORDER BY recipient_email ASC`,
      [sessionId]
    );

    return {
      ...sessionRes.rows[0],
      recipients: recipientsRes.rows,
    };
  }

  /**
   * Merge a partial actions object into a session's `actions` JSON (namespaced
   * by action type, e.g. { outreach: [...] }). Top-level keys are replaced.
   */
  async updateSessionActions(
    sessionId: string,
    user_id: string,
    actions: Record<string, any>
  ): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE email_sessions
          SET actions = COALESCE(actions, '{}'::jsonb) || $1::jsonb
        WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(actions), sessionId, user_id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Replace the full outreach list under actions.outreach. The UI manages
   * add/update/delete client-side and sends the whole list. "interview
   * scheduled" is DERIVED from the list length (no stored flag).
   */
  async setSessionOutreach(
    sessionId: string,
    user_id: string,
    outreach: any[]
  ): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE email_sessions
          SET actions = jsonb_set(
                COALESCE(actions, '{}'::jsonb), '{outreach}', $1::jsonb
              )
        WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(Array.isArray(outreach) ? outreach : []), sessionId, user_id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Replace the full mail_replied list under a recipient's user_actions. The UI
   * manages add/edit/delete client-side and sends the whole array (mixing
   * source:'manual' entries it owns with any source:'auto' ones it read back).
   * Scoped by user_id for safety.
   */
  async setLogReplies(
    logId: number,
    user_id: string,
    mailReplied: any[]
  ): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE email_logs
          SET user_actions = jsonb_set(
                COALESCE(user_actions, '{}'::jsonb), '{mail_replied}', $1::jsonb
              ),
              last_updated = NOW()
        WHERE id = $2 AND user_id = $3`,
      [JSON.stringify(Array.isArray(mailReplied) ? mailReplied : []), logId, user_id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  // ── Bounce scan methods ───────────────────────────────────────────

  /**
   * Returns completed sessions whose scan_status is 'pending'.
   * These are sessions that need to be checked for bounces.
   */
  async getPendingScanSessions(): Promise<
    Array<{
      id: string;
      user_id: string;
      started_at: Date;
      completed_at: Date | null;
      sent_count: number;
      failed_count: number;
    }>
  > {
    const result = await this.pool.query(
      `SELECT id, user_id, started_at, completed_at, sent_count, failed_count
       FROM email_sessions
       WHERE scan_status = 'pending'
         AND status IN ('completed', 'failed')
       ORDER BY started_at ASC`
    );
    return result.rows;
  }

  /**
   * Returns not_verified addresses of type 'sent' (excludes CSV 'imported'),
   * each paired with the user_id that last emailed it (via email_logs) when known.
   * Addresses with no email_logs row get user_id = NULL (caller falls back to a
   * default sender's Gmail account).
   */
  async getNotVerifiedSentAddresses(): Promise<
    Array<{ email: string; user_id: string | null }>
  > {
    const result = await this.pool.query(
      `SELECT ser.email,
              (SELECT el.user_id FROM email_logs el
                WHERE el.recipient_email = ser.email
                ORDER BY el.sent_at DESC NULLS LAST
                LIMIT 1) AS user_id
         FROM sent_email_records ser
        WHERE ser.is_valid = 'not_verified'
          AND ser.type = 'sent'
        ORDER BY ser.email ASC`
    );
    return result.rows;
  }

  async updateScanStatus(sessionId: string, scanStatus: string) {
    await this.pool.query(
      `UPDATE email_sessions SET scan_status = $1 WHERE id = $2`,
      [scanStatus, sessionId]
    );
  }

  /**
   * Get all email logs for a session that were marked as 'sent'.
   */
  async getSentEmailLogsForSession(
    sessionId: string
  ): Promise<Array<{ id: number; recipient_email: string; sent_at: Date }>> {
    const result = await this.pool.query(
      `SELECT id, recipient_email, sent_at
       FROM email_logs
       WHERE session_id = $1 AND status = 'sent'`,
      [sessionId]
    );
    return result.rows;
  }

  /**
   * Update the delivery validity of an address in sent_email_records.
   * Used by the bounce scan: 'failed' when a bounce is detected, 'valid'
   * when an email was confirmed delivered (no bounce in its thread).
   * Only matches addresses that already exist in sent_email_records.
   */
  async updateRecordValidity(
    email: string,
    isValid: "valid" | "failed" | "not_verified"
  ) {
    await this.pool.query(
      `UPDATE sent_email_records
         SET is_valid = $1, updated_at = CURRENT_TIMESTAMP
       WHERE email = $2`,
      [isValid, email]
    );
  }

  /**
   * Update session counts after bounce scan discovers failures.
   */
  async incrementFailedCount(sessionId: string, newFailures: number) {
    await this.pool.query(
      `UPDATE email_sessions
       SET sent_count = sent_count - $1,
           failed_count = failed_count + $1
       WHERE id = $2`,
      [newFailures, sessionId]
    );
  }

  // ── Legacy compat methods (kept for any existing callers) ────────

  async create(data: {
    user_id: string;
    template_id: string;
    global_variables: Record<string, any>;
    receiver_emails: Array<{
      email: string;
      status: string;
      variables: Record<string, any>;
    }>;
    subject: string;
    status: string;
  }) {
    const result = await this.pool.query(
      `INSERT INTO email_logs
          (user_id, template_id, global_variables, subject, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.user_id,
        data.template_id,
        JSON.stringify(data.global_variables),
        data.subject,
        data.status,
      ]
    );
    return result.rows[0];
  }

  async updateStatus(historyId: number, status: string) {
    await this.pool.query(
      `UPDATE email_logs
       SET status = $1, last_updated = NOW()
       WHERE id = $2`,
      [status, historyId]
    );
  }

  async updateRecipientStatus(
    historyId: number,
    email: string,
    status: string
  ) {
    // Now updates by log id and recipient email
    await this.pool.query(
      `UPDATE email_logs
       SET status = $1, last_updated = NOW()
       WHERE session_id = (SELECT session_id FROM email_logs WHERE id = $2 LIMIT 1)
         AND recipient_email = $3`,
      [status, historyId, email]
    );
  }

  async getUserLogs(
    user_id: string,
    last_sent_at: string | null = null
  ): Promise<EmailSession[] | null> {
    // Redirect to the new session-based query
    return this.getUserSessions(user_id, last_sent_at);
  }
}
