import { Router } from "express";
import { EmailController } from "../controllers/email.controller";
import { authMiddleware } from "../middleware/auth.middleware";


export const createEmailRouter = (emailController: EmailController): Router => {
  const router = Router();

  // Enqueue a batch (returns 202). Optional body.scheduledAt for scheduling.
  router.post('/:id', authMiddleware, emailController.sendEmail);

  // Poll a batch's progress.
  router.get('/session/:sessionId/status', authMiddleware, emailController.getSessionStatus);

  return router;
};