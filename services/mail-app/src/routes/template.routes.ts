import { Router } from "express";
import { TemplateController } from "../controllers/templelate.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export const createTemplateRouter = (templateController: TemplateController): Router => {
    const router = Router();
  
    router.post('/', authMiddleware, templateController.createTemplate);
    router.get('/', authMiddleware, templateController.getUserTemplates);
    // router.post('/:id/send', authMiddleware, templateController.sendEmail);
    router.get('/:id' , authMiddleware, templateController.getTemplateById)
    router.put('/:id', authMiddleware, templateController.updateUserTemplate)
  
    return router;
  };