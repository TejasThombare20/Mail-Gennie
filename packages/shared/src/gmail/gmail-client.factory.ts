import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { TokenRepository } from "../repository/token.repository";
import { env } from "../config/env.config";
import logger from "../utils/logger";

/**
 * GmailClientFactory — builds an authenticated gmail_v1.Gmail client for a user.
 *
 * Pattern: Factory. Centralizes the (fiddly) OAuth dance that every service
 * needs, so the token-refresh + invalid_grant probe logic lives in exactly one
 * place. Extracted verbatim from the original bounceScan.service.ts so behaviour
 * is preserved:
 *   1. Access token still valid               -> use directly
 *   2. Access token expired + refresh token   -> refresh + persist
 *   3. Refresh fails (invalid_grant)          -> probe stored access token
 *   4. Probe fails                            -> throw (user must re-auth)
 */
export class GmailClientFactory {
  constructor(private tokenRepository: TokenRepository) {}

  async createForUser(userId: string): Promise<gmail_v1.Gmail> {
    const userToken = await this.tokenRepository.getUserToken(userId);
    if (!userToken) {
      throw new Error(`No tokens found for user ${userId}`);
    }

    // Fresh client per user — avoids shared credential overwrites.
    const oauth2Client = new OAuth2Client({
      clientId: env.google.clientId,
      clientSecret: env.google.clientSecret,
      redirectUri: env.google.redirectUri,
    });

    const isExpired =
      !userToken.token_expiry ||
      new Date(userToken.token_expiry) <= new Date(Date.now() + 5 * 60 * 1000);

    // Step 1: token still valid
    if (!isExpired) {
      logger.info(`[GmailClientFactory] Access token valid for user ${userId}`);
      oauth2Client.setCredentials({
        access_token: userToken.google_token,
        refresh_token: userToken.refresh_token ?? undefined,
      });
      return google.gmail({ version: "v1", auth: oauth2Client });
    }

    // Step 2: try refresh
    logger.info(
      `[GmailClientFactory] Access token expired for user ${userId}, attempting refresh`
    );

    if (!userToken.refresh_token) {
      logger.warn(
        `[GmailClientFactory] No refresh token for user ${userId}, probing stored access token`
      );
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

      logger.info(`[GmailClientFactory] Token refreshed for user ${userId}`);
      return google.gmail({ version: "v1", auth: oauth2Client });
    } catch (refreshErr: any) {
      const isInvalidGrant =
        refreshErr?.message?.includes("invalid_grant") ||
        refreshErr?.response?.data?.error === "invalid_grant";

      if (isInvalidGrant) {
        logger.warn(
          `[GmailClientFactory] Refresh token invalid_grant for user ${userId}, probing stored access token`
        );
        return this.probeAndReturnGmail(oauth2Client, userToken.google_token, userId);
      }
      throw refreshErr;
    }
  }

  /**
   * Last resort: set the stored access token and probe Gmail to check if it
   * still works. Google sometimes accepts tokens past their stated expiry.
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
      logger.info(
        `[GmailClientFactory] Stored access token still accepted for user ${userId}`
      );
      return gmail;
    } catch (error) {
      logger.error(`Error probing access token for user ${userId}: ${error}`);
      throw new Error(
        `All tokens invalid for user ${userId}. User must re-authenticate through the app.`
      );
    }
  }
}
