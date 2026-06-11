/**
 * @app/shared — single source of truth for cross-service infrastructure:
 * config, logging, the db pool, the Gmail OAuth factory, bounce detection,
 * shared repositories, and shared types.
 */

// Config & infrastructure (Singletons)
export { EnvConfig, env } from "./config/env.config";
export { Database, getPool, connectDB } from "./db/database";
export { default as logger } from "./utils/logger";

// Gmail (Factory + Strategy)
export { GmailClientFactory } from "./gmail/gmail-client.factory";
export {
  IBounceSignalDetector,
  HeuristicBounceSignalDetector,
  bounceSignalDetector,
} from "./gmail/bounce-signal.detector";

// Repositories
export { TokenRepository } from "./repository/token.repository";

// Types
export * from "./types";
