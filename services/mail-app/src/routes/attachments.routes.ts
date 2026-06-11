import { Router } from "express";
import { AttachmentController } from "../controllers/attachment.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { fileUploadMiddleware } from "../middleware/file-upload.middleware";

export const createAttachmentRouter = (attachmentController: AttachmentController): Router => {
  const router = Router();

  // router.post('/google-signin', authController.googleSignIn);
  router.post('/upload',authMiddleware,fileUploadMiddleware ,attachmentController.uploadAttachment);
  router.get('/attachment/:id',authMiddleware, attachmentController.getAttachmentByIdWithNewSignedUrl);
  router.get('/user/attachments',authMiddleware, attachmentController.getAttachmentsByUserId)
  router.get('/:id',authMiddleware, attachmentController.deleteAttachment);

  return router;
};