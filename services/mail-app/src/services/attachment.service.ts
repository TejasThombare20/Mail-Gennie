import { MediaStorage } from "../config/media-storage";
import { AttachmentRepository } from "../repository/attachment.repository";
import {
  Attachment,
  EmailAttachment,
  UploadedFile,
} from "../types/attachment.types";
import axios from "axios";
import logger from "../utils/logger";

export class AttachmentService {
  constructor(
    private attachmentRepository: AttachmentRepository,
    private mediaStorage: MediaStorage
  ) {}

  async uploadAttachment(
    file: UploadedFile,
    userId: string
  ): Promise<Attachment | null> {
    try {
      const mediaStorageData = await this.mediaStorage.uploadFile(file, userId);

      if (!mediaStorageData) {
        throw new Error("Failed to upload attachment on cloud storage");
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      const attachment = await this.attachmentRepository.create({
        file_name: file.originalname,
        file_url: mediaStorageData.signedUrl,
        file_type: file.mimetype,
        file_size: file.size,
        user_id: userId,
        filepath: mediaStorageData.filePath,
        expires_at: expiresAt,
      });

      if (!attachment) {
        return null;
      }

      return attachment;
    } catch (error) {
      logger.error("Error uploading attachment", { error });
      return null;
    }
  }

  async getAttachmentsByIds(ids: string[]): Promise<Attachment[] | null> {
    const attachments = this.attachmentRepository.findByIds(ids);

    if (!attachments) {
      return null;
    }

    return attachments;
  }

  async getAttachmentsByUserId(userId: string): Promise<Attachment[] | null> {
    try {
      const attachments = await this.attachmentRepository.findByUserId(userId);

      if (!attachments) {
        return null;
      }
      return attachments;
    } catch (error) {
      logger.error("Error while fetching user's attachments", { error });
      return null
    }
  }
  
  async getUpdatedAttachmentById(attachment_id : string, user_id : string ) : Promise<Attachment | null> {
    try {
        const attachment = await this.attachmentRepository.findById(attachment_id ,user_id );
        if (!attachment) {
         return null;
        }
        if (attachment.expires_at.getTime() < Date.now()) {
         const attachmentMetaData =  await this.getAttachmentBase64(attachment , user_id)
         if(attachmentMetaData){
          attachment.expires_at  = attachmentMetaData.expires_at,
          attachment.file_url = attachmentMetaData.file_url
         }
        }
        return attachment;
    } catch (error) {
      logger.error("Error getting attachment by id", { error });
      return null
    }
  }

  async deleteAttachment(id: string , user_id : string ): Promise<void> {
    const attachment = await this.attachmentRepository.findById(id , user_id);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    const isDeletedSuccessful = await this.mediaStorage.deleteFile(
      attachment.file_url
    );

    if (!isDeletedSuccessful) {
      logger.error("Failed to delete attachment from cloud storage", { id });
      return;
    }

    const isDeletedSuccessfromDB = await this.attachmentRepository.delete(id);

    if (!isDeletedSuccessfromDB) {
      logger.error("Failed to delete attachment from database", { id });
    }
    return;
  }

  async getAttachmentBase64(
    attachment: Attachment,
    userId : string
  ): Promise<EmailAttachment | null> {
    if (new Date(attachment.expires_at) < new Date()) {
      logger.warn("URL expired, regenerating signed URL", { fileName: attachment.file_name, expiresAt: attachment.expires_at });
      const signUrl = await this.mediaStorage.generateSignedUrl(
        attachment.filepath
      );

      if (!signUrl) {
        logger.error("Failed to generate new signed URL", { filepath: attachment.filepath });
        return null;
      }
      attachment.file_url = signUrl;
      attachment.expires_at.setDate(new Date().getDate() + 7);

      const updatedAttachment = await this.attachmentRepository.UpdateAttachment(
         userId,
        attachment.id,
         {
          expires_at : attachment.expires_at,
          file_url : attachment.file_url,
         }
      );
      if (!updatedAttachment){
        logger.error("Failed to update attachment URL and expiry time", { attachmentId: attachment.id })
      }
    }

    try {
      const response = await axios.get(attachment.file_url, {
        responseType: "arraybuffer",
      });

      if (!response.data) {
        logger.error("Failed to fetch attachment data", { fileName: attachment.file_name });
        return null;
      }

      return {
        filename: attachment.file_name,
        expires_at : attachment.expires_at,
        file_url  : attachment.file_url,
        content: Buffer.from(response.data).toString("base64"),
        mimeType:
          response.headers["content-type"] || "application/octet-stream",
      };
    } catch (error) {
      logger.error("Error fetching attachment", { fileName: attachment.file_name, error });
      return null;
    }
  }
}
