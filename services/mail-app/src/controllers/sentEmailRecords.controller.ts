import { Request, Response } from "express";
import { SentEmailRecordsService } from "../services/sentEmailRecords.service";
import logger from "../utils/logger";

export class SentEmailRecordsController {
  constructor(private service: SentEmailRecordsService) {}

  getRecords = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = 100;
      const companyName = req.query.company as string | undefined;

      logger.info("Fetching sent email records", { page, companyName });

      const result = await this.service.getRecords(page, limit, companyName);

      res.status(200).json({
        data: result,
        message: "Records fetched successfully",
        success: true,
      });
    } catch (error) {
      logger.error("Error fetching sent email records", { error });
      res.status(500).json({
        message: "Internal Server Error",
        error: "Failed to fetch records",
        success: false,
      });
    }
  };

  search = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query.q as string;

      if (!query || query.trim().length === 0) {
        res.status(400).json({
          message: "Search query is required",
          success: false,
        });
        return;
      }

      logger.info("Searching sent email records", { query });

      const records = await this.service.search(query.trim());

      res.status(200).json({
        data: records,
        message: "Search completed successfully",
        success: true,
      });
    } catch (error) {
      logger.error("Error searching sent email records", { error });
      res.status(500).json({
        message: "Internal Server Error",
        error: "Failed to search records",
        success: false,
      });
    }
  };

  getCompanies = async (_req: Request, res: Response): Promise<void> => {
    try {
      const companies = await this.service.getCompanies();

      res.status(200).json({
        data: companies,
        message: "Companies fetched successfully",
        success: true,
      });
    } catch (error) {
      logger.error("Error fetching companies", { error });
      res.status(500).json({
        message: "Internal Server Error",
        error: "Failed to fetch companies",
        success: false,
      });
    }
  };
}
