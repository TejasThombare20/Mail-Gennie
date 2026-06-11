import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { UserRepository } from "../repository/user.repository";
import logger from "../utils/logger";
import { IUser } from "../types/users.types";

// [LEGACY - Firebase Auth]
// Initially, authentication was handled via Firebase Admin SDK.
// The frontend would sign in with Google through Firebase, get a Firebase ID token,
// and send it to the backend. The backend would verify it using firebase-admin.
// This was replaced by a direct Google OAuth2 flow (see handleGoogleCallback) to
// remove the Firebase dependency and have full control over tokens and user sessions.
// import { auth } from "../config/firebase-config";
// import { DecodedIdToken } from "firebase-admin/auth";
import { TokenRepository } from "../repository/token.repository";
import { IGoogleUserInfo } from "../types/auth.types";

export class AuthService {
  private oauth2Client: OAuth2Client;

  constructor(
    private userRepository: UserRepository,
    private tokenRepository: TokenRepository
  ) {
    this.oauth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    });
  }
  getAuthUrl(): string | null {
    try {
      const consentScreenURL = this.oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/gmail.send", 
          "https://www.googleapis.com/auth/gmail.compose",
          "https://www.googleapis.com/auth/gmail.readonly"
        ],
        prompt: "consent", // Force to show consent screen to get refresh_token
      });

      if (!consentScreenURL) {
        return null;
      }

      return consentScreenURL;
    } catch (error) {
      logger.error("Error while generating consent screen URL", { error });
      return null;
    }
  }

  async handleGoogleCallback(
    code: string
  ): Promise<{ user: IUser; token: string }> {
    // Exchange code for tokens
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    const userInfo = await this.getUserInfo(tokens.access_token!);

    let user = await this.userRepository.findUserByEmail(userInfo.email);

    if (!user) {
      user = await this.userRepository.createUser({
        email: userInfo?.email,
        name: userInfo?.name,
        picture: userInfo?.picture,
        id: userInfo?.id,
      });         
    }

    // Always update tokens on sign-in (handles both new and existing users)
    // Note: Google only returns refresh_token on first consent or when prompt=consent is forced.
    // Pass it as-is — saveUserToken uses COALESCE to preserve existing refresh_token if null.
    await this.tokenRepository.saveUserToken(
      user.id,
      tokens.access_token!,
      new Date(tokens.expiry_date!),
      tokens.refresh_token ?? undefined
    );

    // Generate JWT for API authentication  
    const jwtToken = this.generateJWT(user);

    logger.info("JWT token generated for user", { userId: user.id });

    return { user, token: jwtToken };
  }

  private async getUserInfo(accessToken: string): Promise<IGoogleUserInfo> {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get user info"); 
    }

    return response.json();
  }

  async refreshAccessToken(userId: string): Promise<string> {
    const userToken = await this.tokenRepository.getUserToken(userId);
    if (!userToken?.refresh_token) {
      throw new Error("No refresh token available");
    }

    try {
      this.oauth2Client.setCredentials({
        refresh_token: userToken.refresh_token,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update tokens in database
      await this.tokenRepository.saveUserToken(
        userId,
        credentials.access_token!,
        new Date(credentials.expiry_date!),
        userToken.refresh_token // Keep existing refresh token
      );

      return credentials.access_token!;
    } catch (error) {
      throw new Error("Failed to refresh access token");
    }
  }

  // [LEGACY - Firebase Auth Step 1]
  // The frontend sent a Firebase ID token to the backend after signing in via Firebase Google provider.
  // This method verified that token using firebase-admin and returned the decoded user info (email, uid, etc).
  // Replaced by: the OAuth2 authorization code flow in handleGoogleCallback, where the backend
  // directly exchanges a Google auth code for tokens — no Firebase in the middle.
  // async verifyFirebaseToken(token: string): Promise<DecodedIdToken> {
  //   const data = await auth.verifyIdToken(token);
  //   return data;
  // }

  // [LEGACY - Firebase Auth Step 2]
  // After verifyFirebaseToken decoded the Firebase token, this method used the decoded Firebase user
  // (which carries uid, email, name, picture) to create/find the user in our DB and issue a JWT.
  // The Google OAuth code was also exchanged here to get access/refresh tokens for Gmail API usage.
  // Problem: Firebase uid was used as the user id, tightly coupling our DB to Firebase.
  // Replaced by: handleGoogleCallback which does the same thing but derives the user id directly
  // from Google's userinfo API, removing the Firebase dependency entirely.
  // async handleGoogleSignIn(
  //   firebaseUser: DecodedIdToken,
  //   code: string
  // ): Promise<{ user: IUser; token: string }> {
  //   let user = await this.userRepository.findUserByEmail(firebaseUser.email!);
  //   const { tokens } = await this.oauth2Client.getToken(code);
  //   if (!user) {
  //     user = await this.userRepository.createUser({
  //       email: firebaseUser.email!,
  //       name: firebaseUser.name!,
  //       picture: firebaseUser.picture,
  //       id: firebaseUser?.uid,
  //     });
  //     await this.tokenRepository.saveUserToken(
  //       user?.id,
  //       tokens?.access_token!,
  //       new Date(tokens.expiry_date!),
  //       tokens?.refresh_token!
  //     );
  //   }
  //   const token = this.generateJWT(user);
  //   return { user, token };
  // }

  private generateJWT(user: IUser): string {
    return jwt.sign(
      { userId: user?.id, email: user?.email },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" }
    );
  }
}
