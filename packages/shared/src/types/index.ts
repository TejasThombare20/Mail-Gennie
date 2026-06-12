/**
 * Shared types used across services. Kept minimal: only the shapes the workers
 * and the API genuinely share (tokens, recipient validity, the send-job payload).
 */

import { EmailAttachment, Variable } from "./email.types";

export * from "./email.types";

export interface IUserToken {
  user_id: string;
  google_token: string;
  token_expiry: Date;
  refresh_token?: string;
  created_at: Date;
  updated_at: Date;
}

/** Recipient address delivery validity, mirrors sent_email_records.is_valid. */
export type RecordValidity = "not_verified" | "valid" | "failed";

/** Result of verifying a single address against Gmail. */
export type AddressVerification = "valid" | "failed" | "not_verified";

/**
 * Payload for a single queued send job (queue-service `send_email` task).
 * One job == one recipient; the session groups them via a per-session queue.
 *
 * Rendering happens in the worker, so the payload carries the raw subject and
 * the variables to substitute. Attachment BYTES are resolved once per batch at
 * enqueue time (mail-app owns Firebase) and passed here pre-resolved, so the
 * worker never touches storage.
 */
export interface SendEmailJobPayload {
  sessionId: string;
  userId: string;
  logId: number;
  templateId: string;
  recipientEmail: string;
  /** Raw subject (may still contain {{placeholders}} — rendered in the worker). */
  subject: string;
  localVariables: Variable[];
  globalVariables: Variable[];
  /** Pre-resolved attachments (base64), shared across the whole batch. */
  attachments: EmailAttachment[];
  /** Company name for the sent_email_records upsert (denormalized for the worker). */
  companyName: string | null;
  /** Index within the session; used to enforce the per-session send gap. */
  recipientIndex: number;
}
