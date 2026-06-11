import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { IUserToken } from "../types";
import logger from "../utils/logger";

/**
 * TokenRepository — persistence for per-user Google OAuth tokens.
 *
 * Receives the Pool via constructor injection (Dependency Injection) so it stays
 * decoupled from how the pool is created and remains unit-testable.
 */
export class TokenRepository {
  constructor(private pool: Pool) {}

  async saveUserToken(
    userId: string,
    googleToken: string,
    tokenExpiry: Date,
    refreshToken?: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO user_tokens (user_id, google_token, token_expiry, refresh_token, id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE
        SET google_token = $2,
            token_expiry = $3,
            refresh_token = COALESCE($4, user_tokens.refresh_token),
            updated_at = CURRENT_TIMESTAMP
      `;
      await this.pool.query(query, [
        userId,
        googleToken,
        tokenExpiry,
        refreshToken ?? null,
        uuidv4(),
      ]);
    } catch (error) {
      logger.error("Error while saving user token", { error, userId });
    }
  }

  async getUserToken(userId: string): Promise<IUserToken | null> {
    const query = "SELECT * FROM user_tokens WHERE user_id = $1";
    const result = await this.pool.query(query, [userId]);
    return result.rows[0] || null;
  }
}
