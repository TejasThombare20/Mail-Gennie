import { Attachment } from "./attachment.type";
import { EmailTemplate } from "./template-types";

export type getGoolgleUrlApiResponse = string

export type getUserTemplatesApiResponse = Omit<EmailTemplate, "attachments"> & {
    attachments: string[];
    attachmentsdata: Attachment[];
    created_at : string;
  };

export type postUserTemplateApiResponse = Omit<EmailTemplate, "id"> & {
 id : string;
}

