import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { Attachment } from "../types/attachment.types";
import logger from "../utils/logger";

export class AttachmentRepository {
  constructor(private pool: Pool) {} // Replace 'any' with your database client type

  async create(
    attachment: Omit<Attachment, "id" | "uploaded_at">
  ): Promise<Attachment | null> {
    try {
      const result = await this.pool.query(
        `INSERT INTO attachments (file_name, file_url, file_type, file_size, user_id, filepath, expires_at, id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8 )
         RETURNING *`,
        [
          attachment.file_name,
          attachment.file_url,
          attachment.file_type,
          attachment.file_size,
          attachment.user_id,
          attachment.filepath,
          attachment.expires_at,
          uuidv4(),
        ]
      );
      return result.rows[0];
    } catch (error) {
      logger.error("Error while creating attachment", { error });
      return null;
    }
  }

  async findById(id: string, user_id: string): Promise<Attachment | null> {
    try {
      const result = await this.pool.query(
        "SELECT * FROM attachments WHERE id = $1 AND user_id = $2",
        [id, user_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error("Error while fetching attachment by Id", { error });
      return null;
    }
  }

  async findByIds(ids: string[]): Promise<Attachment[] | null> {
    try {
      if (ids.length === 0) return [];
      const result = await this.pool.query(
        "SELECT * FROM attachments WHERE id = ANY($1::uuid[])",
        [ids]
      );
      return result?.rows;
    } catch (error) {
      logger.error("Error while finding attachments by ids", { error });
      return null;
    }
  }

  async findByUserId(userId: string): Promise<Attachment[] | null> {
    try {
      const result = await this.pool.query(
        "SELECT * FROM attachments WHERE user_id = $1",
        [userId]
      );
      return result?.rows;
    } catch (error) {
      logger.error("Error while finding attachments by user id", { error });
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "DELETE FROM attachments WHERE id = $1 RETURNING id",
        [id]
      );
      if (!result) {
        return false;
      }
      return true;
    } catch (error) {
      logger.error("Error while deleting attachment", { error });
      return false;
    }
  }

  async UpdateAttachment( user_id : string, attachment_id : string, attachement : Partial<Attachment>) : Promise<Attachment | null>{

    try {
      const query = `
        UPDATE attachments
          SET 
            file_name = COALESCE($1, file_name),
            file_size = COALESCE($2, file_size),
            file_url = COALESCE($3, file_url),
            file_type = COALESCE($4, file_type),
            filepath = COALESCE($5, filepath),
            expires_at = COALESCE($6::timestamp, expires_at)
        WHERE id = $7 AND user_id = $8
        RETURNING *;
      `;
      const values = [
        attachement.file_name,
        attachement?.file_size,
        attachement?.file_url,
        attachement?.file_type,
        attachement?.filepath,
        attachement?.expires_at ? new Date(attachement.expires_at).toISOString() : null,
        attachment_id,
        user_id,
      ];
      
      const result = await this.pool.query(query , values)
      return result.rows[0];
      
    } catch (error) {
      logger.error("Error while updating the attachment", { error })
      return null;
    }

  }
}
