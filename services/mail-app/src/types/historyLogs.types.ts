import { variable } from "./template.types";

// One auto/manual reply captured for a recipient (stored in user_actions.mail_replied).
export interface ReplyEntry {
  response_message: string;
  responded_at: string;
  source: "auto" | "manual";
}

// Per-recipient actions namespace (email_logs.user_actions).
export interface UserActions {
  mail_replied?: ReplyEntry[];
}

// One person who scheduled / set up an interview (stored in actions.outreach).
export interface OutreachPerson {
  id: string;
  interview_scheduler_name: string;
  email: string;
  contact_number: string;
  company?: string;
}

// Session-level actions namespace (email_sessions.actions).
export interface SessionActions {
  outreach?: OutreachPerson[];
}

// Represents a single email_sessions row
export interface EmailSession {
  id: string;
  user_id: string;
  template_id: string;
  template_name?: string;
  subject: string;
  global_variables: variable[];
  total_emails: number;
  sent_count: number;
  failed_count: number;
  status: string;
  scan_status: 'pending' | 'in_progress' | 'done';
  // Session-level actions, namespaced by type (e.g. { outreach: [...] }).
  actions?: SessionActions;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  // List-only aggregates (returned by the History list query, not details).
  recipient_count?: number;
  has_responded?: boolean;
  // Joined from email_logs (only on the details query)
  email_logs?: EmailLogEntry[];
}

// Represents a single per-recipient email_logs row
export interface EmailLogEntry {
  id: number;
  session_id: string;
  user_id: string;
  template_id: string;
  recipient_email: string;
  local_variables: variable[];
  global_variables: variable[];
  subject: string;
  status: string;
  // Per-recipient actions, namespaced by type (e.g. { mail_replied: [...] }).
  user_actions?: UserActions;
  sent_at: Date;
  last_updated: Date;
}

// Keep backward compat alias
export type EmailLog = EmailSession;
