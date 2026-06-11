import { GlobalTemplateVariable } from "./template-types";

// One recipient row of a session, used to populate the responded-form select.
export interface OutreachRecipient {
  id: number;
  recipient_email: string;
  status: string;
  user_actions: Record<string, any>;
}

// Session details returned for the outreach form (pre-fill + context).
export interface OutreachSession {
  id: string;
  subject: string;
  template_name: string | null;
  status: string;
  started_at: string;
  global_variables: GlobalTemplateVariable[];
  outreach_details: Record<string, any>;
  recipient_companies: string[];
  recipients: OutreachRecipient[];
}

// One person who scheduled / set up an interview (multiple allowed per session).
export interface Interviewer {
  id: string;
  name: string;
  number: string;
  email: string;
  company?: string;
  notes?: string;
}

// Shape stored in email_sessions.outreach_details
export interface InterviewOutreachDetails {
  interview_scheduled?: boolean;
  interviewers?: Interviewer[];
  // legacy single-object shape (pre multi-entity); read for backward compat
  reachout?: {
    name?: string;
    number?: string;
    email?: string;
    company?: string;
  };
}
