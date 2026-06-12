import { Pool } from "pg";
import logger from "../utils/logger";

export interface SentEmailRecord {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  sent_at: string;
  type: "sent" | "imported";
  is_valid: "not_verified" | "valid" | "failed";
  created_at: string;
  updated_at: string;
}

export class SentEmailRecordsRepository {
  constructor(private pool: Pool) {}

  async getRecords(
    page: number,
    limit: number,
    companyName?: string
  ): Promise<{ records: SentEmailRecord[]; total: number }> {
    try {
      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const values: any[] = [];

      if (companyName) {
        conditions.push(`company_name = $${values.length + 1}`);
        values.push(companyName);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const countQuery = `SELECT COUNT(*) FROM sent_email_records ${whereClause}`;
      const countResult = await this.pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count, 10);

      const dataQuery = `
        SELECT * FROM sent_email_records
        ${whereClause}
        ORDER BY sent_at DESC NULLS LAST, created_at DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;
      const dataResult = await this.pool.query(dataQuery, [
        ...values,
        limit,
        offset,
      ]);

      return { records: dataResult.rows, total };
    } catch (error) {
      logger.error("Error fetching sent email records", { error });
      throw error;
    }
  }

  async search(query: string): Promise<SentEmailRecord[]> {
    try {
      const searchPattern = `%${query}%`;
      const result = await this.pool.query(
        `SELECT * FROM sent_email_records
         WHERE first_name ILIKE $1
            OR last_name ILIKE $1
            OR email ILIKE $1
            OR company_name ILIKE $1
         ORDER BY sent_at DESC
         LIMIT 50`,
        [searchPattern]
      );
      return result.rows;
    } catch (error) {
      logger.error("Error searching sent email records", { error });
      throw error;
    }
  }

  /**
   * Upsert a 'sent' delivery record. is_valid resets to 'not_verified' so the
   * bounce/reply pipeline re-checks the address on a re-send. Mirrors the shared
   * SendJobRepository.upsertSentRecord used by the queue worker (this one serves
   * the legacy direct-send path in EmailService).
   */
  async upsertSent(
    firstName: string,
    email: string,
    companyName: string | null
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO sent_email_records (first_name, email, company_name, sent_at, type, is_valid)
       VALUES ($1, $2, $3, NOW(), 'sent', 'not_verified')
       ON CONFLICT (email) DO UPDATE
         SET type     = 'sent',
             sent_at  = EXCLUDED.sent_at,
             is_valid = 'not_verified'`,
      [firstName, email, companyName]
    );
  }

  async getCompanies(): Promise<string[]> {
    try {
      const result = await this.pool.query(
        `SELECT DISTINCT company_name FROM sent_email_records
         WHERE company_name IS NOT NULL AND company_name != ''
         ORDER BY company_name ASC`
      );
      return result.rows.map((row: any) => row.company_name);
    } catch (error) {
      logger.error("Error fetching companies", { error });
      throw error;
    }
  }
}
