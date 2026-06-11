export interface Recipient {
    email: string;
  }

  export interface EmailBatch {
    templateId: string;
    subject: string;
    globalVariables: Record<string, string>;
    recipients: Recipient[];
  }

  export interface SendEmailFormData {
    recipients: string[];
    templateId: string;
    subject: string;
    globalVariableValues: Record<string, string>;
  }