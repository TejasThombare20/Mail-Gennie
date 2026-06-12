import { Task, JobHelpers } from "graphile-worker";
import {
  SendEmailJobPayload,
  SendJobRepository,
  EmailLogRepository,
  templateRenderer,
  createEmailBody,
  extractReceiverNameFromEmail,
  getPool,
  logger,
  SEND_GAP_SECONDS,
} from "@app/shared";
import { TemplateCache } from "../cache/template.cache";
import { GmailSender } from "../gmail/gmail-sender";

const sendJobRepo = new SendJobRepository(getPool());
const emailLogRepo = new EmailLogRepository(getPool());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * SendEmailTask — Command that sends one recipient's email.
 *
 * Pattern: Command. graphile-worker invokes this with the job payload. The unit
 * of work is fully described by the payload (one recipient), so it is retryable
 * and idempotent-friendly.
 *
 * Pacing: because mail-app enqueues every job in a session under the same
 * per-session queue (queueName = session_<id>), graphile-worker runs them one
 * at a time. We sleep SEND_GAP_SECONDS at the END of each job so consecutive
 * sends in the same session are spaced out, while OTHER sessions (other queues)
 * proceed in parallel, unaffected.
 *
 * Idempotency: if a crash re-runs a job after Gmail already accepted the
 * message, we would double-send. We guard by skipping logs already marked
 * 'sent'. (The DB log status is our idempotency key.)
 */
export const sendEmailTask: Task = async (payload, helpers: JobHelpers) => {
  const job = payload as SendEmailJobPayload;
  const {
    sessionId,
    userId,
    logId,
    templateId,
    recipientEmail,
    subject,
    localVariables,
    globalVariables,
    attachments,
    companyName,
  } = job;

  // ── Idempotency guard ──────────────────────────────────────────────
  // If this log is already 'sent', a previous attempt succeeded; don't resend.
  const existingStatus = await emailLogRepo.getStatus(logId);
  if (existingStatus === "sent") {
    logger.warn("[send_email] log already sent, skipping", { logId, recipientEmail });
    return;
  }

  // ── Render ────────────────────────────────────────────────────────
  const template = await TemplateCache.getInstance().get(templateId, userId);
  if (!template) {
    // No template -> permanent failure for this job. Mark failed, count it.
    logger.error("[send_email] template missing, failing job", { templateId, logId });
    await sendJobRepo.updateEmailLogStatus(logId, "failed");
    await sendJobRepo.recordSendResult(sessionId, "failed");
    return; // returning (not throwing) avoids pointless retries for a missing template
  }

  const { html, subject: renderedSubject, localVarsUsed } = templateRenderer.render({
    html: template.html_content,
    subject,
    recipient: recipientEmail,
    localVariables,
    globalVariables,
  });

  const emailBody = createEmailBody(recipientEmail, renderedSubject, html, attachments);
  const encodedMessage = Buffer.from(emailBody)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // ── Send ──────────────────────────────────────────────────────────
  const sender = GmailSender.getInstance();
  try {
    const { status, messageId, threadId, rfc822MessageId } = await sender.send(
      userId,
      encodedMessage
    );

    if (status === 200) {
      // Persist 'sent' + the ids so the pubsub-service can attribute an inbound
      // reply back to THIS log exactly (by thread, or by the reply's References
      // header), not just the latest send to this address.
      await sendJobRepo.markSent(logId, { messageId, threadId, rfc822MessageId });

      const firstName =
        localVarsUsed.find((v) => v.key === "receiver_name")?.value ||
        extractReceiverNameFromEmail(recipientEmail);
      await sendJobRepo.upsertSentRecord(firstName, recipientEmail, companyName);

      const counts = await sendJobRepo.recordSendResult(sessionId, "sent");
      logger.info("[send_email] sent", {
        recipientEmail,
        logId,
        progress: counts
          ? `${counts.sent_count + counts.failed_count}/${counts.total_emails}`
          : undefined,
      });
    } else {
      logger.warn("[send_email] unexpected Gmail status", { recipientEmail, status });
      await sendJobRepo.updateEmailLogStatus(logId, "failed");
      await sendJobRepo.recordSendResult(sessionId, "failed");
    }
  } catch (err: any) {
    // Auth errors: drop the cached client so a retry re-authenticates, and
    // rethrow so graphile-worker retries with backoff.
    const msg = err?.message ?? String(err);
    logger.error("[send_email] send failed", {
      recipientEmail,
      logId,
      error: msg,
      attempt: helpers.job.attempts,
      maxAttempts: helpers.job.max_attempts,
    });

    sender.invalidate(userId);

    // On the final attempt graphile-worker won't retry again — record the
    // failure so the session can complete.
    if (helpers.job.attempts >= helpers.job.max_attempts) {
      await sendJobRepo.updateEmailLogStatus(logId, "failed");
      await sendJobRepo.recordSendResult(sessionId, "failed");
      return;
    }
    throw err; // retry
  } finally {
    // ── Per-session pacing ──────────────────────────────────────────
    // Sleep AFTER the send so the next job in this (serial) session queue can't
    // start for SEND_GAP_SECONDS. Other sessions' queues are unaffected.
    await sleep(SEND_GAP_SECONDS * 1000);
  }
};
