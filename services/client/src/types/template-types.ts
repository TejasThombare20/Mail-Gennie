import { UUIDTypes } from "uuid";
import { Attachment } from "./attachment.type";

export interface TemplateVariable {
  key: string;
  description: string;
  id : string;
  value?: string;
}

export interface GlobalTemplateVariable {
  key: string;
  id : string;
  description?: string;
  value ? : string;
}


export interface TemplateData {
    name: string;
    category: string;
    json_data: any;
    html_content: string;
    attachments: File[];
    localVariables: TemplateVariable[];
    globalVariables: TemplateVariable[];
  }
  

export interface EmailTemplate {
    id?: string;
    name: string;
    category: string;
    attachments: Attachment[];
    json_data : any;
    html_content: string;
    local_variables: TemplateVariable[];
    global_variables: GlobalTemplateVariable[];

  } 

export interface Design {
  counters: {
    u_column: number;
    u_row: number;
    u_content_image: number;
    u_content_text: number;
    u_content_divider: number;
    u_content_button: number;
    u_content_html: number;
    // Add other counters as needed
  };
  body: {
    rows: Array<{
      cells: number[];
      columns: Array<{
        contents: Array<{
          type: string;
          values: {
            containerPadding?: string;
            text?: string;
            // Add other properties as needed
          };
        }>;
        values: {
          backgroundColor?: string;
          padding?: string;
          // Add other properties as needed
        };
      }>;
      values: {
        displayCondition?: any;
        columns?: boolean;
        backgroundColor?: string;
        // Add other properties as needed
      };
    }>;
    // Add other body properties as needed
  };
  // Add other top-level properties as needed
}
