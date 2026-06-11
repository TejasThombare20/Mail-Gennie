import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  user?: { userId: string; email: string };
}

export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {

      const token = req.cookies.auth_token; 
      
      if (!token) {
        res.status(401).json({ error: 'Authentication required' , message : "User not authenticated" ,success : false });
        return;
      }
  
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        email: string;
      };     
  
      req.user = decoded;
      next();
    } catch (error) {
      logger.warn("Auth token verification failed", { error });
      res.status(401).json({ error: 'Invalid token' , message : "Token expired error " , success : false  });
    }
  };