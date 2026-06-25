import { GlobalTemplateVariable, TemplateVariable } from "./template-types";
import { UserActions } from "./outreach";

// Per-recipient email log entry
export interface EmailLogEntry {
  id: number;
  session_id: string;
  recipient_email: string;
  local_variables: TemplateVariable[];
  status: string;
  user_actions?: UserActions;
  sent_at: string;
  last_updated: string;
}

// Session-level response (replaces old getEmailLogsApiResponse)
//
// The History LIST endpoint returns only the lightweight fields plus the two
// aggregates (`recipient_count`, `has_responded`). The heavy `global_variables`
// and `email_logs` are populated lazily by the details endpoint when a row is
// expanded or "View details" is opened — so they're optional here.
export interface getEmailLogsApiResponse {
  id: string;
  user_id: string;
  template_id: string;
  template_name: string;
  subject: string;
  global_variables?: GlobalTemplateVariable[];
  total_emails: number;
  sent_count: number;
  failed_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  // List-only aggregates (present on the list payload).
  recipient_count?: number;
  has_responded?: boolean;
  // Populated lazily by the details endpoint.
  email_logs?: EmailLogEntry[];
}
