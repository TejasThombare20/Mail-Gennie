/**
 * Shared types used across services. Kept minimal: only the shapes the workers
 * and the API genuinely share (tokens, recipient validity, the send-job payload).
 */

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

/** Per-recipient template variable (key/value), as stored on email_logs. */
export interface TemplateVariable {
  key: string;
  value: string;
  id?: string;
  description?: string;
  recipient_email?: string;
}

/**
 * Payload for a single queued send job (queue-service `send_email` task).
 * One job == one recipient; the session groups them via a per-session queue.
 */
export interface SendEmailJobPayload {
  sessionId: string;
  userId: string;
  logId: number;
  templateId: string;
  recipientEmail: string;
  subject: string;
  localVariables: TemplateVariable[];
  globalVariables: TemplateVariable[];
}
