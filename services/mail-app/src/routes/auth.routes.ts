import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

export const createAuthRouter = (authController: AuthController): Router => {
  const router = Router();

  // router.post('/google-signin', authController.googleSignIn);
  router.get('/google/url', authController.getAuthUrl);
  router.get('/google/callback', authController.handleCallback);
  router.get('/me', authMiddleware, authController.getMe);
  router.post('/logout', authController.logout);

  return router;
};