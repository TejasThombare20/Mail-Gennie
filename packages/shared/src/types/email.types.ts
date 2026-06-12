/**
 * Email/template shapes shared between mail-app (enqueue side) and
 * queue-service (render + send side).
 */

/** A template placeholder variable (key/value), as stored on templates/logs. */
export interface Variable {
  key: string;
  id?: string;
  description?: string;
  value?: string;
  recipient_email?: string;
}

/** A fully-resolved attachment ready to be embedded into a MIME body. */
export interface EmailAttachment {
  filename: string;
  content: string; // base64
  mimeType: string;
  expires_at?: Date;
  file_url?: string;
}

/** A templates-table row (subset the worker needs to render). */
export interface ITemplate {
  id: string;
  user_id: string;
  name: string;
  json_data: Record<string, any>;
  html_content: string;
  attachments: string[];
  category: string;
  created_at: Date;
  updated_at: Date;
  local_variables: Variable[];
  global_variables: Variable[];
}

export interface EmailStatus {
  email: string;
  status?: "sent" | "failed" | "invalid";
  variables?: Record<string, any>;
}
