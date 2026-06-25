import { PoolClient } from "pg";
import pool from "../config/database";
import { EmailService } from "./email.service";
import {
  TASK_SEND_EMAIL,
  sessionQueueName,
  SendEmailJobPayload,
  EmailAttachment,
  SessionRepository,
  EmailLogRepository,
  JobQueue,
  logger,
} from "@app/shared";

interface RecipientVar {
  key: string;
  description?: string;
  id: string;
  recipient_email?: string;
  value?: string;
}
interface GlobalVar {
  key: string;
  value: string;
  id: string;
}

export interface EnqueueResult {
  sessionId: string;
  queued: number;
  scheduledFor: string | null;
}

/**
 * EmailEnqueueService — replaces the blocking send loop. It does the heavy,
 * once-per-batch work (template + attachment resolution) up front, then inside a
 * SINGLE Postgres transaction:
 *   1. creates the email_sessions row,
 *   2. creates a 'queued' email_logs row per recipient,
 *   3. enqueues one graphile-worker `send_email` job per recipient.
 *
 * Because the session rows AND the jobs commit together, we never end up with a
 * logged session whose jobs were lost (or vice-versa). Each session's jobs share
 * a per-session queue so the worker serializes them (with the 2.5s gap) while
 * other sessions run in parallel.
 */
export class EmailEnqueueService {
  constructor(
    private emailService: EmailService,
    private sessionRepository: SessionRepository,
    private emailLogRepository: EmailLogRepository,
    private jobQueue: JobQueue
  ) {}

  async enqueueBatch(params: {
    userId: string;
    templateId: string;
    subject: string;
    recipients: string[];
    localVariables: RecipientVar[];
    globalVariables: GlobalVar[];
    /** ISO timestamp to schedule the batch; null/undefined = send now. */
    scheduledAt?: string | null;
  }): Promise<EnqueueResult> {
    const {
      userId,
      templateId,
      recipients,
      localVariables,
      globalVariables,
      scheduledAt,
    } = params;

    // Heavy work ONCE per batch (Firebase attachment resolution lives here).
    // prepareBatch also returns the template's default subject so we can fall
    // back to it when the client didn't supply one.
    const { attachments, subject: templateSubject } =
      await this.emailService.prepareBatch(userId, templateId);

    // Effective subject: the user's typed subject wins; otherwise use the
    // template's default subject. Placeholders ({{...}}) inside it are resolved
    // per-recipient by TemplateRenderer at send time.
    const subject =
      params.subject && params.subject.trim().length > 0
        ? params.subject
        : templateSubject ?? "";

    const companyName =
      globalVariables.find((v) => v.key === "company_name")?.value ?? null;

    const runAt = scheduledAt ? new Date(scheduledAt) : null;
    const queueName = sessionQueueName; // helper, applied per session below

    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Session row (inside the transaction)
      const sessionId = await this.sessionRepository.createQueued(
        {
          userId,
          templateId,
          subject,
          globalVariables,
          totalEmails: recipients.length,
        },
        client
      );
      const sessionQueue = queueName(sessionId);

      let index = 0;
      for (const recipient of recipients) {
        const recipientLocalVars = localVariables.filter(
          (v) => !v.recipient_email || v.recipient_email === recipient
        );

        // 2. Per-recipient log row (status 'queued', same transaction)
        const logId = await this.emailLogRepository.createQueued(
          {
            sessionId,
            userId,
            templateId,
            recipientEmail: recipient,
            localVariables: recipientLocalVars,
            globalVariables,
            subject,
          },
          client
        );

        // 3. Enqueue the send job IN THE SAME TRANSACTION (via the JobQueue port,
        //    passing `client` so it commits atomically with the rows above).
        //    jobKey dedups so the same log can't be double-queued.
        const payload: SendEmailJobPayload = {
          sessionId,
          userId,
          logId,
          templateId,
          recipientEmail: recipient,
          subject,
          localVariables: recipientLocalVars,
          globalVariables,
          attachments: attachments as EmailAttachment[],
          companyName,
          recipientIndex: index,
        };

        await this.jobQueue.enqueue(
          TASK_SEND_EMAIL,
          payload,
          {
            queueName: sessionQueue,
            runAt,
            jobKey: `send_email:${logId}`,
            maxAttempts: 5,
          },
          client
        );

        index++;
      }

      await client.query("COMMIT");

      logger.info("[EmailEnqueue] batch enqueued", {
        sessionId,
        queued: recipients.length,
        scheduledFor: runAt ? runAt.toISOString() : null,
      });

      return {
        sessionId,
        queued: recipients.length,
        scheduledFor: runAt ? runAt.toISOString() : null,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error("[EmailEnqueue] enqueue failed, rolled back", { error: (err as Error).message });
      throw err;
    } finally {
      client.release();
    }
  }
}
