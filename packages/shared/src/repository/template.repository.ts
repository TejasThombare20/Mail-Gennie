import { Pool } from "pg";
import { ITemplate } from "../types/email.types";
import logger from "../utils/logger";

/**
 * TemplateRepository — read access to the templates table that the worker needs
 * to render emails. (Write/update operations remain in mail-app's own copy.)
 */
export class TemplateRepository {
  constructor(private pool: Pool) {}

  async getTemplateById(id: string, user_id: string): Promise<ITemplate | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM templates WHERE id = $1 AND user_id = $2;`,
        [id, user_id]
      );

      if (!result.rows[0]) return null;

      const template = result.rows[0];
      template.attachments =
        Array.isArray(template.attachments) && template.attachments[0]
          ? template.attachments
          : [];

      return template;
    } catch (error) {
      logger.error("Error while getting template by id", { error });
      return null;
    }
  }
}
