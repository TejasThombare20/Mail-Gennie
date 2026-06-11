import {
  SentEmailRecordsRepository,
  SentEmailRecord,
} from "../repository/sentEmailRecords.repository";
import logger from "../utils/logger";

export class SentEmailRecordsService {
  constructor(private repository: SentEmailRecordsRepository) {}

  async getRecords(
    page: number,
    limit: number,
    companyName?: string
  ): Promise<{ records: SentEmailRecord[]; total: number; page: number; totalPages: number }> {
    const { records, total } = await this.repository.getRecords(page, limit, companyName);
    const totalPages = Math.ceil(total / limit);
    return { records, total, page, totalPages };
  }

  async search(query: string): Promise<SentEmailRecord[]> {
    return this.repository.search(query);
  }

  async getCompanies(): Promise<string[]> {
    return this.repository.getCompanies();
  }
}
