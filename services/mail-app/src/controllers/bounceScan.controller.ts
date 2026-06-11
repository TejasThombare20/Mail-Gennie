import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { BounceScanService } from "../services/bounceScan.service";
import { runBounceScan } from "../cron/bounceScan.cron";
import logger from "../utils/logger";

export class BounceScanController {
  constructor(private bounceScanService: BounceScanService) {}

  /**
   * POST /api/bounce-scan/trigger
   * Manually trigger a bounce scan.
   */
  triggerScan = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await runBounceScan(this.bounceScanService);
      const statusCode = result.success ? 200 : 409;
      res.status(statusCode).json(result);
    } catch (error) {
      logger.error("Failed to trigger bounce scan", { error });
      res.status(500).json({
        success: false,
        message: "Internal server error while running bounce scan",
      });
    }
  };
}
