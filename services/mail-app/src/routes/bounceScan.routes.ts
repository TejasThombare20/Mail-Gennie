import { Router } from "express";
import { BounceScanController } from "../controllers/bounceScan.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export const createBounceScanRouter = (
  bounceScanController: BounceScanController
): Router => {
  const router = Router();

  // Manual trigger — requires authentication
  router.post("/trigger", authMiddleware, bounceScanController.triggerScan);

  return router;
};
