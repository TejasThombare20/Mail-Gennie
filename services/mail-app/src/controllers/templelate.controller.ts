import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { TemplateService } from "../services/template.service";
import { EmailService } from "../services/email.service";
import { AttachmentService } from "../services/attachment.service";
import logger from "../utils/logger";
import { htmlToUnlayerDesign, isEmptyDesign } from "../utils/html-to-unlayer-design";
export class TemplateController {
  constructor(
    private templateService: TemplateService,
    private emailService: EmailService,
    private attachmentService: AttachmentService
  ) {}

  createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { name, json_data, html_content, category, attachments, local_variables , global_variables } = req.body;

      // If json_data is missing/empty but html_content is provided, generate Unlayer design from HTML
      const resolvedJsonData =
        isEmptyDesign(json_data) && html_content
          ? htmlToUnlayerDesign(html_content)
          : json_data;

      const template = await this.templateService.createTemplate({
        user_id: req.user!.userId,
        name,
        json_data: resolvedJsonData,
        html_content: html_content,
        attachments: attachments,
        category,
        local_variables,
        global_variables,
      });
      if(!template){
        res.status(404).json({ error : "Unable to create template", message: "Failed to create template", success: false });
        return;
      }
      res.status(201).json({data : template , success: true, message : "Template created successfully"});

    } catch (error) {
      logger.error("Failed to create template", { error });
      res.status(500).json({ error: "Failed to create template" , message : "Internal server error" , success : false });
    }
  };

  getUserTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const templates = await this.templateService.getUserTemplates(
        req.user!.userId
      );

      if(!templates){
        res.status(404).json({ error : "unable to fetch templates data", message: "No templates found" , success: false });
        return;
      }
      res.status(200).json({data : templates , message : "All templates fetch successfully" , success : true});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" , messag : "Internal Sever Error" , success: false });
    }
  };

  // sendEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  //   try {
  //     const { recipients, variables, subject } = req.body;
  //     const templateId = req.params.id;

  //     if (!templateId) {
  //       res.status(400).json({ error: "Template ID is required", message : "can't send  mail without template" , success : false });
  //       return;
  //     }

  //     if (!recipients || !recipients?.length) {
  //       res.status(400).json({
  //         error: "at least one receipts required Recipients are required",
  //       });
  //       return;
  //     }

  //     await this.emailService.sendEmail(
  //       req.user!.userId,
  //       templateId,
  //       subject,
  //       recipients,
  //       variables
  //     );

  //     res.status(200).json({ message: "Email sent successfully" });
  //   } catch (error) {
  //     console.error(error);
  //     res.status(500).json({ error: "Failed to send email" });
  //   }
  // };

  updateUserTemplate = async (req : AuthRequest , res : Response) => {
    try {
      const userId = req.user?.userId!

      const templatesData = req.body
      
      const templateId = req.params.id

      if(!userId) {
         res.status(404).json({ error : "UserId is missing " ,message: "user is not authenticated" , success : false });
         return
      }

      const updatedTemplateData = await this.templateService.updateTemplate(
        userId,
        templatesData,
        templateId
      );

      if(!updatedTemplateData){
         res.status(400).json({error : "failed to update the template" , message : "Template not update",succses : false})
         return 
      }

       res.status(200).json({ data : updatedTemplateData,message : "template update successfully" , success : true})

    } catch (error) {
      logger.error("Error while updating template", { error });
       res.status(500).json({ error : "error while  updating an template",message : "Internal server error " , success : false})
    }


  }

  getTemplateById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const templateId = req.params.id;
      const user_id = req.user?.userId!

      if (!templateId) {
        res.status(400).json({ error: "Template ID is required" });
        return;
      }
      const template = await this.templateService.getTemplateById(templateId,user_id);
      if (!template) {
        res.status(404).json({ error: "Template not found" });
        return;
      }

      // If json_data is empty but html_content exists, generate Unlayer design on-the-fly
      if (isEmptyDesign(template.json_data) && template.html_content) {
        template.json_data = htmlToUnlayerDesign(template.html_content);
      }

      const attachments = template.attachments;

      if (attachments && attachments.length > 0) {
        const attahcmentsData =
          await this.attachmentService.getAttachmentsByIds(attachments);

        if (!attahcmentsData) {
          res.status(500).json({ error: "Failed to fetch attachments data" , success : false , message : "failed to fetch attachments data" });
          return;
        }
        template.attachmentsdata = attahcmentsData;
      }
      res.status(200).json({
        data: template,
        success: true,
        message: "data fetch successfully",
      });
    } catch (error: any) {
      res.status(500).json({
        error: error?.message,
        success: false,
        message: "Internal Server Error ",
      });
    }
  };


}
