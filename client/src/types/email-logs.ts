import { GlobalTemplateVariable, TemplateVariable } from "./template-types";

// Per-recipient email log entry
export interface EmailLogEntry {
  id: number;
  session_id: string;
  recipient_email: string;
  local_variables: TemplateVariable[];
  status: string;
  user_actions?: Record<string, any>;
  sent_at: string;
  last_updated: string;
}

// Session-level response (replaces old getEmailLogsApiResponse)
export interface getEmailLogsApiResponse {
  id: string;
  user_id: string;
  template_id: string;
  template_name: string;
  subject: string;
  global_variables: GlobalTemplateVariable[];
  total_emails: number;
  sent_count: number;
  failed_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  email_logs: EmailLogEntry[];
}
