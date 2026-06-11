import { Response } from "express";
import { AttachmentService } from "../services/attachment.service";
import { AuthRequest } from "../middleware/auth.middleware";
import logger from "../utils/logger";

export class AttachmentController {
  constructor(private attachmentService: AttachmentService) {}

  uploadAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      logger.info("File upload request received", { filename: req.file?.originalname, size: req.file?.size });

      if (!req.file) {
        res.status(400).json({ error: "No file provided" , message : "File not found" , success : false });
        return;
      }

      const attachment = await this.attachmentService.uploadAttachment(
        req.file,
        req.user!.userId
      );

      if (!attachment) {
        throw Error("failed to store the attachement ");
      }

      res.status(201).json({data : attachment, message : "successfully store the attachment" , success : true});
    } catch (error) {
      logger.error("Failed to upload attachment", { error });
      res.status(500).json({ error: "Failed to upload attachment" , message : "Internal Server Error", success : true });
    }
  };

  deleteAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.params.id) {
        res.status(400).json({ error: "No attachment id provided" , message : "Unauthorized resource" , success : false });
        return;
      }
      const userId = req.user?.userId!
      const attachmentId = req.params.id;
      await this.attachmentService.deleteAttachment(attachmentId,userId);
      res.status(200).json({ message: "Attachment deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  };

  getAttachmentsByUserId = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const attachments = await this.attachmentService.getAttachmentsByUserId(
        req.user!.userId
      );

      if (!attachments) {
        res.status(404).json({
          error: "unable to fetch attachments data",
          message: "No attachments found",
          success: false,
        });
        return;
      }

      res.status(200).json({
        data: attachments,
        message: "Attachments successfully retrieved",
        success: true,
      });
    } catch (error) {
      logger.error("Error while fetching attachments by userId", { error });
      res.status(500).json({
        error: "Failed to fetch attachments by userId",
        message: "Internal Server Error ",
        success: false,
      });
    }
  };

  getAttachmentByIdWithNewSignedUrl = async (req : AuthRequest, res : Response) => {
      try {
        const attachmentId =  req.params.id;
        const userId = req.user?.userId!

        if (!attachmentId){
          res.status(400).json({ error: "No attachment id provided" , message : "Unauthorized resource" , success : false });
          return;
        }
        
        const attachmetData = await this.attachmentService.getUpdatedAttachmentById(attachmentId , userId)

        if (!attachmetData) {
          res.status(404).json({ error: "No attachment found" , message : "No attachments found" , success : false });
          return;
        }

        res.status(200).json({ data : attachmetData, success : true , message : "Attachment fetch successfully"})
      } catch (error) {
        logger.error("Error while fetching attachment by id", { error })
        res.status(500).json({ error: "Failed to fetch attachment by id" , message : "Internal Server Error" , success : false });
      }
  }
    
}
