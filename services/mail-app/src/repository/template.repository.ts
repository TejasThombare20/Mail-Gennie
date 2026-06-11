import { Pool } from "pg";
import { v4 as uuidv4 } from 'uuid';
import { ITemplate } from "../types/template.types";
import logger from "../utils/logger";

export class TemplateRepository {
    constructor(private pool: Pool) {}
  
    async createTemplate(template: Omit<ITemplate, 'id' | 'created_at' | 'updated_at'>): Promise<ITemplate | null> {
      try {
      const query = `
        INSERT INTO templates (user_id, name, json_data, html_content, attachments, category, id, local_variables, global_variables )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const values = [
        template?.user_id,
        template?.name,
        template?.json_data,
        template?.html_content,
        template?.attachments,
        template?.category,
        uuidv4(),
        JSON.stringify(template?.local_variables || []),  
        JSON.stringify(template?.global_variables || []) 
      ];
      const result = await this.pool.query(query, values);
      return result.rows[0];

    } catch (error) {
      logger.error("Error while creating new template", { error })
        return null
    }
    }

  async updateUserTemplate( user_id : string, template : Partial<ITemplate>,templateId : string ) : Promise<ITemplate | null> {
    try {

        const query = `
          UPDATE templates 
          SET 
            name = COALESCE($1, name),
            json_data = COALESCE($2, json_data),
            html_content = COALESCE($3, html_content),
            attachments = COALESCE($4, attachments),
            category = COALESCE($5, category),
            local_variables = COALESCE($6, local_variables),
            global_variables = COALESCE($7, global_variables)
          WHERE id = $8 AND user_id = $9
          RETURNING *;
      `;
      const values = [
        template?.name,
        template?.json_data,
        template?.html_content,
        template?.attachments,
        template?.category,
        template?.local_variables ? JSON.stringify(template.local_variables) : null,
        template?.global_variables ? JSON.stringify(template.global_variables) : null,
        templateId,
        user_id
      ];
      
      const result = await this.pool.query(query , values)
      return result.rows[0];
    } catch (error) {
      logger.error("Error while updating template", { error });
      return null
    }
  }
  
    async getUserTemplates(userId: string): Promise<ITemplate[] | null> {
      try {
      const query = 'SELECT * FROM templates WHERE user_id = $1 ORDER BY created_at DESC';
      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error("Error while fetching user templates from DB", { error })
      return null;
    }
    }

    async getTemplateById(id: string , user_id : string): Promise<ITemplate | null> {
      try {
      const result = await this.pool.query(
         `SELECT * FROM templates WHERE id = $1 AND user_id = $2;`,
        [id , user_id]
      );

      if (!result.rows[0]) return null;

      const template = result.rows[0];
      template.attachments = Array.isArray(template.attachments) && template.attachments[0] ? template.attachments : [];

      return template;

    } catch (error) {
      logger.error("Error while getting template by id", { error });
      return null;
    }
    }


    async updateTemplate(
      id: number,
      template: Partial<{
        name: string;
        subject: string;
        html_content: string;
        attachment_ids: number[];
      }>
    ): Promise<ITemplate | null> {
      const setClause = Object.entries(template)
        .map(([key, _], index) => `${key} = $${index + 2}`)
        .join(', ');
  
      const result = await this.pool.query(
        `UPDATE templates 
         SET ${setClause}
         WHERE id = $1
         RETURNING *`,
        [id, ...Object.values(template)]
      );
      
      return result.rows[0] || null;
    }
  }
  

  
  