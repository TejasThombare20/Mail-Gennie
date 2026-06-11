import { Router } from "express";
import { LogHistoryController } from "../controllers/logHistory.controller";
import { authMiddleware } from "../middleware/auth.middleware";



export const createLogHistoryRouter = (logHistoryController: LogHistoryController): Router => {
  const router = Router();

  router.get('/dashboard/stats', authMiddleware, logHistoryController.getDashboardStats);
  router.get('/dashboard/sessions', authMiddleware, logHistoryController.getDashboardSessions);
  router.get('/dashboard/emails-by-company-date', authMiddleware, logHistoryController.getEmailsByCompanyDate);

  // Outreach / user-action endpoints (must come before the catch-all below)
  router.get('/session/:sessionId/outreach', authMiddleware, logHistoryController.getSessionForOutreach);
  router.patch('/session/:sessionId/outreach', authMiddleware, logHistoryController.updateSessionOutreach);
  router.put('/session/:sessionId/interviewers', authMiddleware, logHistoryController.setSessionInterviewers);
  router.patch('/log/:logId/actions', authMiddleware, logHistoryController.updateLogActions);

  router.get('/:last_sent_at?',authMiddleware, logHistoryController.getUserEmailLogs);

  return router;
};