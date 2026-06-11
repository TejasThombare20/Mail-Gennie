import { variable } from "./template.types";

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
  // Session-level outreach info (interview scheduled, person who reached out, etc.)
  outreach_details?: Record<string, any>;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  // Joined from email_logs
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
  // Per-recipient user-level action flags (responded, referred, etc.)
  user_actions?: Record<string, any>;
  sent_at: Date;
  last_updated: Date;
}

// Keep backward compat alias
export type EmailLog = EmailSession;
