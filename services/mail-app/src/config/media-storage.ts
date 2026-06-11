import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { UploadedFile, uploadFileResponse } from "../types/attachment.types";
import logger from "../utils/logger";

export class MediaStorage {
  private supabase: SupabaseClient;
  private bucketName: string;
  private urlExpiryTime: number;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.bucketName = "attachments";
    this.urlExpiryTime = 518400;
  }

  async uploadFile(
    file: UploadedFile,
    userId: string
  ): Promise<uploadFileResponse | null> {
    try {
      const filePath = this.generateFilePath(file.mimetype, userId);

      // Upload to Supabase
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "518400",
          upsert: false,
        });

      logger.info("Supabase upload response", { path: data?.path });

      if (error) {
        logger.error("Error while uploading file to Supabase", { error });
        return null;
      }

      const signedUrl = await this.generateSignedUrl(filePath);

      if (!signedUrl) {
        return null;
      }

      return { signedUrl, filePath };
    } catch (error) {
      logger.error("File upload error", { error });
      return null;
    }
  }

  async generateSignedUrl(filePath: string): Promise<string | null> {

    logger.info("Generating signed URL", { filePath });

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, this.urlExpiryTime);

    if (error) {
      logger.error("Error while generating signed URL", { error });
      return null;
    }
    return data.signedUrl;
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async listFiles(prefix?: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(prefix || "");

      if (error) throw error;
      return data.map((file) => file.name);
    } catch (error) {
      return [];
    }
  }

  private generateFilePath(originalName: string, userId: string): string {
    const timestamp = Date.now();
    const extension = originalName.split(".").pop();
    return `${userId}_${timestamp}_${originalName}`;
  }

  async moveFile(oldPath: string, newPath: string): Promise<boolean> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .move(oldPath, newPath);

      return !error;
    } catch (error) {
      return false;
    }
  }
}
