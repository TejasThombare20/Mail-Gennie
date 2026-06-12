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
export { WatchManager } from "./gmail/watch.manager";
export {
  IBounceSignalDetector,
  HeuristicBounceSignalDetector,
  bounceSignalDetector,
} from "./gmail/bounce-signal.detector";

// Email rendering (worker + API share these)
export {
  isValidEmail,
  checkMXRecord,
  extractReceiverNameFromEmail,
  sanitizeNonAscii,
  createEmailBody,
} from "./email/email.utils";
export { TemplateRenderer, templateRenderer } from "./email/template-renderer";

// LLM provider port (provider-neutral; concrete impls live in the consuming service)
export {
  LLMProvider,
  ToolSchema,
  ToolCallRequest,
  SchemaType,
} from "./llm/llm-provider";

// Queue contract (shared by enqueue side + worker side)
export {
  TASK_SEND_EMAIL,
  SEND_GAP_SECONDS,
  sessionQueueName,
} from "./queue/queue.constants";
export { JobQueue, JobConsumer, EnqueueOptions } from "./queue/job-queue";
export { GraphileJobQueue } from "./queue/graphile-job-queue";

// Repositories
export { TokenRepository } from "./repository/token.repository";
export { TemplateRepository } from "./repository/template.repository";
export { SendJobRepository } from "./repository/send-job.repository";
export { SessionRepository, SessionStatusRow } from "./repository/session.repository";
export { EmailLogRepository } from "./repository/email-log.repository";
export {
  WatchStateRepository,
  GmailWatchState,
} from "./repository/watch-state.repository";
export { InboxEventRepository } from "./repository/inbox-event.repository";

// Types
export * from "./types";
