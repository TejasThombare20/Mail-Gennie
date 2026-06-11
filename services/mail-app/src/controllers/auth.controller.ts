import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { UserRepository } from "../repository/user.repository";
import { AuthRequest } from "../middleware/auth.middleware";
import logger from "../utils/logger";

export class AuthController {
  constructor(private authService: AuthService, private userRepository?: UserRepository) {}

  getAuthUrl = async(req: Request, res: Response): Promise<void> => {
    try {
      const url =  await this.authService.getAuthUrl();
      if(!url){
        res.status(500).json({ message :"Internal Server Error" ,error: "Failed to generate authorization URL from google server" , success : false })
        return;
      }

    res.status(200).json({ data : url, message : "consent screen url fetch successfully" , success : true });
    } catch (error) {
      logger.error("Auth error:", error);
      res.status(500).json({ message :"Internal Server Error" ,error: "Failed to get authorization URL" , success : false });
    }
  };

  handleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.query;

      if (!code || typeof code !== "string") {
        res.status(400).json({ error: "Authorization code required" });
        return;
      }
      const { token: JWT_token } = await this.authService.handleGoogleCallback(
        code
      );
      res.cookie("auth_token", JWT_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });

      const redirectUrl =  process.env.CLIENT_URL! + process.env.AUTH_REDIRECT_ENDPOINT! 

      res.redirect(redirectUrl);
      // res.json(result);
    } catch (error) {
      logger.error("Auth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    try {
      res.clearCookie("auth_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.status(200).json({ message: "Logged out successfully", success: true });
    } catch (error) {
      logger.error("Logout error:", error);
      res.status(500).json({ message: "Internal Server Error", success: false });
    }
  };

  getMe = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId || !this.userRepository) {
        res.status(401).json({ message: "Not authenticated", success: false });
        return;
      }

      const user = await this.userRepository.findUserById(userId);
      if (!user) {
        res.status(404).json({ message: "User not found", success: false });
        return;
      }

      res.status(200).json({
        data: { id: user.id, name: user.name, email: user.email, picture: user.picture },
        message: "User profile fetched successfully",
        success: true,
      });
    } catch (error) {
      logger.error("Error fetching user profile", { error });
      res.status(500).json({ message: "Internal Server Error", success: false });
    }
  };

  // googleSignIn = async (req: Request, res: Response): Promise<void> => {
  //   try {
  //     const { token } = req.body;

  //     if (!token) {
  //       res.status(400).json({ error: 'Firebase token is required' });
  //       return;
  //     }

  //     const firebaseUser = await this.authService.verifyFirebaseToken(token);
  //     const { user, token:JWTtoken } = await this.authService.handleGoogleSignIn(firebaseUser ,token );

  //     res.cookie("auth_token", JWTtoken, {
  //       httpOnly: true,
  //       secure: process.env.NODE_ENV === "production",
  //       sameSite: "strict",
  //       maxAge: 24 * 60 * 60 * 1000
  //     });
  //     res.status(200).json({ user, JWTtoken });
  //   } catch (error) {
  //     console.error('Auth error:', error);
  //     res.status(500).json({ error: 'Authentication failed' });
  //   }
  // };
}
