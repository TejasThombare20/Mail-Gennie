import { AttachmentRepository } from "../repository/attachment.repository";
import { TemplateRepository } from "../repository/template.repository";
import logger from "../utils/logger";
import { ITemplate } from "../types/template.types";

export class TemplateService {
  constructor(
    private templateRepository: TemplateRepository,
    private attachmentRepository: AttachmentRepository
  ) {}

  async createTemplate(
    templateData: Omit<ITemplate, "id" | "created_at" | "updated_at">
  ): Promise<ITemplate | null> {
    try {
      if (templateData.attachments?.length > 0) {
        const attachments = await this.attachmentRepository.findByIds(
          templateData.attachments
        );

        if (!attachments) {
          throw new Error("Unbable to find attachments");
        }

        if (attachments.length !== templateData.attachments.length) {
          throw new Error("One or more attachment IDs are invalid");
        }
      }
      const newTemplate = this.templateRepository.createTemplate(templateData);

      if (!newTemplate) {
        return null;
      }

      return newTemplate;
    } catch (error) {
      logger.error("Error in template service - createTemplate", { error });
      return null;
    }
  }

  async getUserTemplates(userId: string): Promise<ITemplate[] | null> {
    const tempatesData = this.templateRepository.getUserTemplates(userId);
    if (!tempatesData) {
      return null;
    }
    return tempatesData;
  }

  async getTemplateById(
    templateId: string,
    user_id: string
  ): Promise<ITemplate | null> {
    return this.templateRepository.getTemplateById(templateId, user_id);
  }

  async updateTemplate(
    user_id: string,
    updatedTemplateData: Partial<ITemplate>,
    templateId : string
  ): Promise<ITemplate | null> {
    try {
      const template = await this.templateRepository.getTemplateById(
        templateId,
        user_id,
      );

      if (!template) {
        logger.warn("Template not found for update", { user_id, templateId });
        return null;
      }

      const updatedTemplate = await this.templateRepository.updateUserTemplate(
        user_id,
        updatedTemplateData,
        templateId
      );

      if (!updatedTemplate) {
        return null;
      }

      return updatedTemplate;
    } catch (error) {
      logger.error("Error in template service - updateTemplate", { error });
      return null;
    }
  }
}
