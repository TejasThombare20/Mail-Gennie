import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { EmailService } from "../services/email.service";
import logger from "../utils/logger";


export class EmailController {
    constructor(private emailService: EmailService) {}


    sendEmail = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
          const { recipients, local_variables,global_variables, subject } = req.body;
          const templateId = req.params.id;

          if (!templateId) {
            res.status(400).json({ error: "Template ID is required", message : "can't send  mail without template" , success : false });
            return;
          }

          if (!recipients || !recipients?.length) {
            res.status(400).json({
              error: "at least one receipts required Recipients are required",
            });
            return;
          }

          await this.emailService.sendEmail(
            req.user!.userId,
            templateId,
            subject,
            recipients,
            local_variables,
            global_variables
          );

          res.status(200).json({ message: "Email sent successfully" , success : true });
        } catch (error) {
          logger.error("Failed to send email", { error });
          res.status(500).json({ error: "Failed to send email" , message : "Internal Server Error" ,success : false});
        }
      };
}
