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
  attachmentsdata?: Attachment[];
}

export interface EmailStatus {
  email: string;
  status?: "sent" | "failed" | "invalid";
  variables?: Record<string, any>;
}
