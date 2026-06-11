import { Router } from "express";
import { SentEmailRecordsController } from "../controllers/sentEmailRecords.controller";

export const createSentEmailRecordsRouter = (
  controller: SentEmailRecordsController
): Router => {
  const router = Router();

  // GET /api/sent-records?page=1&company=CompanyName
  router.get("/", controller.getRecords);

  // GET /api/sent-records/search?q=searchterm
  router.get("/search", controller.search);

  // GET /api/sent-records/companies
  router.get("/companies", controller.getCompanies);

  return router;
};
