import { Router } from "express";
import { EmailController } from "../controllers/email.controller";
import { authMiddleware } from "../middleware/auth.middleware";


export const createEmailRouter = (emailController: EmailController): Router => {
  const router = Router();

  router.post('/:id',authMiddleware ,emailController.sendEmail);
  
  return router;
};