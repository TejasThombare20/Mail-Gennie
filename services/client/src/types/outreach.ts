import { GlobalTemplateVariable } from "./template-types";

// One auto/manual reply captured for a recipient (user_actions.mail_replied[]).
export interface ReplyEntry {
  response_message: string;
  responded_at: string;
  source: "auto" | "manual";
}

// Per-recipient actions namespace (email_logs.user_actions).
export interface UserActions {
  mail_replied?: ReplyEntry[];
}

// One recipient row of a session, used to populate the responded-form select.
export interface OutreachRecipient {
  id: number;
  recipient_email: string;
  status: string;
  user_actions: UserActions;
}

// One person who scheduled / set up an interview (multiple allowed per session).
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

// Session details returned for the outreach form (pre-fill + context).
export interface OutreachSession {
  id: string;
  subject: string;
  template_name: string | null;
  status: string;
  started_at: string;
  global_variables: GlobalTemplateVariable[];
  actions: SessionActions;
  recipient_companies: string[];
  recipients: OutreachRecipient[];
}
