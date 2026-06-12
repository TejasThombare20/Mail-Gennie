import { Pool } from "pg";

export interface GmailWatchState {
  user_id: string;
  email_address: string;
  last_history_id: string | null;
  watch_expiry: Date | null;
}

/**
 * WatchStateRepository — per-user Gmail Pub/Sub watch + historyId cursor.
 * Used by the pubsub-service to know where to resume history.list() from and by
 * the watch-renewal job to re-arm expiring watches.
 */
export class WatchStateRepository {
  constructor(private pool: Pool) {}

  async get(userId: string): Promise<GmailWatchState | null> {
    const res = await this.pool.query(
      `SELECT user_id, email_address, last_history_id, watch_expiry
       FROM gmail_watch_state WHERE user_id = $1`,
      [userId]
    );
    return res.rows[0] ?? null;
  }

  async getByEmail(email: string): Promise<GmailWatchState | null> {
    const res = await this.pool.query(
      `SELECT user_id, email_address, last_history_id, watch_expiry
       FROM gmail_watch_state WHERE email_address = $1`,
      [email]
    );
    return res.rows[0] ?? null;
  }

  /** All users with a watch (for the renewal job to iterate). */
  async listAll(): Promise<GmailWatchState[]> {
    const res = await this.pool.query(
      `SELECT user_id, email_address, last_history_id, watch_expiry FROM gmail_watch_state`
    );
    return res.rows;
  }

  /** Upsert the watch arming result (email + expiry + the baseline historyId). */
  async upsertWatch(
    userId: string,
    email: string,
    historyId: string,
    watchExpiry: Date
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO gmail_watch_state (user_id, email_address, last_history_id, watch_expiry, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET email_address   = EXCLUDED.email_address,
             last_history_id = EXCLUDED.last_history_id,
             watch_expiry    = EXCLUDED.watch_expiry,
             updated_at      = NOW()`,
      [userId, email, historyId, watchExpiry]
    );
  }

  /** Advance the processed-history cursor after handling a notification. */
  async advanceHistoryId(userId: string, historyId: string): Promise<void> {
    await this.pool.query(
      `UPDATE gmail_watch_state
       SET last_history_id = $2, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, historyId]
    );
  }
}
