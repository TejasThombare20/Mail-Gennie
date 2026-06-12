import { Response } from "express";
import { SessionRepository } from "@app/shared";
import { AuthRequest } from "../middleware/auth.middleware";
import { EmailEnqueueService } from "../services/emailEnqueue.service";
import { AgentEnrichmentService } from "../services/agentEnrichment.service";
import logger from "../utils/logger";

export class EmailController {
  constructor(
    private emailEnqueueService: EmailEnqueueService,
    private agentEnrichmentService: AgentEnrichmentService,
    private sessionRepository: SessionRepository
  ) {}

  /**
   * Accept a batch, enqueue it, and return 202 immediately. The actual sends
   * (with the per-session 2.5s gap) happen in the queue-service worker. The
   * client polls GET /api/email/session/:id/status for progress.
   *
   * Optional body.scheduledAt (ISO timestamp) schedules the batch for later;
   * omit it to send as soon as the worker picks the jobs up.
   */
  sendEmail = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        recipients,
        local_variables,
        global_variables,
        subject,
        scheduledAt,
        // Optional AI-agent inputs: per-recipient hints + a global steering prompt.
        recipient_info,
        extra_prompt,
      } = req.body;
      const templateId = req.params.id;

      if (!templateId) {
        res.status(400).json({
          error: "Template ID is required",
          message: "can't send mail without template",
          success: false,
        });
        return;
      }

      if (!recipients || !recipients?.length) {
        res.status(400).json({
          error: "at least one recipient is required",
          success: false,
        });
        return;
      }

      // Run the AI agents to fill any missing receiver_name / product_info
      // values before enqueuing. The CLI sends names pre-computed, so this is a
      // no-op there; the UI sends raw emails and relies on this step.
      const { localVariables, globalVariables } =
        await this.agentEnrichmentService.enrich({
          templateId,
          recipients,
          localVariables: local_variables ?? [],
          globalVariables: global_variables ?? [],
          recipientInfo: recipient_info ?? [],
          extraPrompt: extra_prompt ?? undefined,
        });

      const result = await this.emailEnqueueService.enqueueBatch({
        userId: req.user!.userId,
        templateId,
        subject,
        recipients,
        localVariables,
        globalVariables,
        scheduledAt: scheduledAt ?? null,
      });

      // Echo back the resolved first names so the UI can reveal what the agent
      // generated. One entry per recipient (value may be "" by design).
      const generatedNames = recipients.map((email: string) => {
        const v = localVariables.find(
          (lv) =>
            lv.key === "receiver_name" &&
            (lv.recipient_email === email || !lv.recipient_email)
        );
        return { email, firstName: v?.value ?? "" };
      });

      res.status(202).json({
        message: result.scheduledFor
          ? "Email batch scheduled successfully"
          : "Email batch queued successfully",
        success: true,
        data: { ...result, generatedNames },
      });
    } catch (error) {
      logger.error("Failed to enqueue email batch", { error });
      res.status(500).json({
        error: "Failed to enqueue email batch",
        message: "Internal Server Error",
        success: false,
      });
    }
  };

  /**
   * Poll the progress of a queued/scheduled batch. Returns the session row's
   * counts and status so the client can show a progress bar.
   */
  getSessionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const sessionId = req.params.sessionId;
      const userId = req.user!.userId;

      const row = await this.sessionRepository.getStatusForUser(sessionId, userId);

      if (!row) {
        res.status(404).json({ message: "Session not found", success: false });
        return;
      }

      const processed = (row.sent_count ?? 0) + (row.failed_count ?? 0);

      res.status(200).json({
        success: true,
        data: {
          ...row,
          processed,
          pending: Math.max(0, (row.total_emails ?? 0) - processed),
        },
      });
    } catch (error) {
      logger.error("Failed to fetch session status", { error });
      res.status(500).json({ message: "Internal Server Error", success: false });
    }
  };
}
