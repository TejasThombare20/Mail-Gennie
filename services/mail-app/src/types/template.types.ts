import { Attachment } from "./attachment.types";


export interface variable {
  key: string;
  id : string;
  description?: string;
  value?: string;
}


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
  local_variables :variable[];
  global_variables : variable[];
  /** Default subject line for this template (may contain {{placeholders}}). */
  subject?: string | null;
  /** Stable per-user number used for tag-based routing (e.g. "template 4"). */
  template_number?: number | null;
  attachmentsdata?: Attachment[];
}

export interface EmailStatus {
  email: string;
  status?: "sent" | "failed" | "invalid";
  variables?: Record<string, any>;
}
