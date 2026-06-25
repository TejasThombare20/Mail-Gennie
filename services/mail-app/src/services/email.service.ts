/**
 * ============================================================================
 * EMAIL SERVICE — Template Management & Email Sending
 * ============================================================================
 *
 * SUPPORTED EMAIL TEMPLATES:
 * ────────────────────────────
 *
 * Template 1: "Referral Request" (DEFAULT)
 * ──────────────────────────────────────
 * Use Case: Cold email asking someone you don't know directly for a referral
 * Context: General outreach to networks, colleagues, or professionals in target companies
 * Tone: Polite, brief, respectful of their time
 * Placeholders: {{receiver_name}}, {{company_name}}, {{ROLE}}, {{JOB_ID}}, {{portal_link}}
 *
 * Content excerpt:
 *   "Apologies for the cold email — I'll keep it brief."
 *   "...feel my experience could be a good fit. If you're comfortable, would you be
 *    open to referring me?"
 *
 * When to use: Default choice unless user specifies otherwise
 *
 * ---
 *
 * Template 2: "Direct Hiring Manager Outreach"
 * ────────────────────────────────────────────
 * Use Case: Reaching out directly to a hiring manager after seeing their LinkedIn post
 * Context: Direct application after manager publicly posts about an opening
 * Tone: Professional, enthusiastic, direct
 * Placeholders: {{receiver_name}}, {{company_name}}, {{ROLE}}, {{portal_link}}
 *
 * Content excerpt:
 *   "I came across your LinkedIn post about the {{ROLE}} opening on your team at {{company_name}},
 *    and I'd love to be considered for the role."
 *   "I've attached my resume for your review. Would be happy to share more details
 *    or hop on a quick call at your convenience."
 *
 * When to use: When the user has a direct contact with the hiring manager or found them
 *              via their public job posting on LinkedIn
 *
 * ---
 *
 * Template 3: "Team Member Indirect Referral"
 * ──────────────────────────────────────────
 * Use Case: Outreach to a team member (not the hiring manager) to forward resume
 * Context: When you have a connection at the company but not the hiring manager
 * Tone: Friendly, respectful, asks for help without pressure
 * Placeholders: {{receiver_name}}, {{company_name}}, {{ROLE}}, {{portal_link}}
 *
 * Content excerpt:
 *   "Since you're on the team, I thought you might be the right person to reach out to."
 *   "If my profile seems like a fit, would you mind forwarding my resume to the hiring
 *    manager or pointing me to the best way to apply?"
 *
 * When to use: When reaching out to a team member who can help forward your application
 *              to the right person or department
 *
 * ============================================================================
 * PLACEHOLDER QUICK REFERENCE:
 * ============================================================================
 *
 * Mandatory Placeholders:
 *   {{receiver_name}}    — Recipient's first name (auto-extracted from email or provided)
 *   {{company_name}}     — Company name (global variable, applies to all recipients)
 *   {{portal_link}}      — URL to job posting, LinkedIn post, or career portal
 *
 * Optional Placeholders (have sensible defaults):
 *   {{ROLE}}             — Job role name (defaults to "SDE" if not provided)
 *   {{JOB_ID}}           — Job posting ID (Template 1 only, can be empty)
 *
 * Empty Placeholder Handling:
 *   The service automatically removes empty placeholders and fixes surrounding whitespace.
 *   Example: "Hi {{receiver_name}}" → "Hi" (if receiver_name is empty)
 *
 * ============================================================================
 * WHEN SENDING EMAILS — DECISION FLOWCHART:
 * ============================================================================
 *
 * 1. Is the recipient a HIRING MANAGER with a public job post?
 *    → Use Template 2 (Direct Hiring Manager Outreach)
 *
 * 2. Is the recipient a TEAM MEMBER who works at the company?
 *    → Use Template 3 (Team Member Indirect Referral)
 *
 * 3. Is the recipient someone you don't know well / cold outreach?
 *    → Use Template 1 (Referral Request) — DEFAULT
 *
 * If unsure, default to Template 1.
 *
 * ============================================================================
 */

import { google } from "googleapis";
import { gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { TokenRepository } from "../repository/token.repository";
import { TemplateRepository } from "../repository/template.repository";
import { HistoryRepository } from "../repository/history.repository";
import { EmailStatus } from "../types/template.types";
import {
  checkMXRecord,
  createEmailBody,
  extractReceiverNameFromEmail,
  isValidEmail,
  sanitizeNonAscii,
} from "../utils/validate-email";
import { AttachmentRepository } from "../repository/attachment.repository";
import { SentEmailRecordsRepository } from "../repository/sentEmailRecords.repository";
import { Attachment, EmailAttachment } from "../types/attachment.types";
import { AttachmentService } from "./attachment.service";
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

// Helper function to add delay between emails
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const EMPTY_SENTINEL = '%%EMPTY%%';

/**
 * Replaces a template placeholder in text.
 * When the value is empty, inserts a sentinel marker instead.
 * Call cleanupEmptyPlaceholders() after all replacements to remove
 * sentinels and fix surrounding whitespace.
 */
function replacePlaceholder(text: string, key: string, value: string): string {
  const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
  if (value && value.trim().length > 0) {
    return text.replace(regex, value);
  }
  return text.replace(regex, EMPTY_SENTINEL);
}

/**
 * Removes sentinel markers left by empty placeholder replacements,
 * collapses surrounding whitespace, and trims space before punctuation.
 *
 * "Hello %%EMPTY%%,"  → "Hello,"
 * "Hi %%EMPTY%% - X"  → "Hi - X"
 */
function cleanupEmptyPlaceholders(text: string): string {
  // Replace sentinel + surrounding spaces with a single space
  text = text.replace(new RegExp(`\\s*${EMPTY_SENTINEL}\\s*`, 'g'), '');
  // Remove space before punctuation ("Hello ," → "Hello,")
  text = text.replace(/\s+([,.!?;:])/g, '$1');
  // Collapse multiple spaces
  text = text.replace(/\s{2,}/g, ' ');
  return text.trim();
}

/**
 * Replaces any remaining unmatched placeholders with empty strings.
 * This ensures no {{variable}} patterns are left in the final email.
 *
 * Example: "Hello {{name}} - {{unknown}}" → "Hello  - "
 * Then cleanupEmptyPlaceholders() will fix spacing.
 */
function replaceRemainingPlaceholders(text: string): string {
  // Match any remaining {{...}} placeholders and replace with EMPTY_SENTINEL
  text = text.replace(/\{\{[^}]+\}\}/g, EMPTY_SENTINEL);
  return text;
}

export class EmailService {
  private oauth2Client: OAuth2Client;
  constructor(
    private tokenRepository: TokenRepository,
    private templateRepository: TemplateRepository,
    private historyRepository: HistoryRepository,
    private attahcmentRepository: AttachmentRepository,
    private attachmentService: AttachmentService,
    private sentEmailRecordsRepository: SentEmailRecordsRepository
  ) {
    this.oauth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    });
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

  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    try {
      const userToken = await this.tokenRepository.getUserToken(userId);

      // Check if token is expired or will expire in the next 5 minutes
      const isExpired =
        new Date(userToken?.token_expiry!) <=
        new Date(Date.now() + 5 * 60 * 1000);

      if (isExpired) {
        const newAccessToken = await this.refreshAccessToken(userId);
        this.oauth2Client.setCredentials({ access_token: newAccessToken });
      } else {
        this.oauth2Client.setCredentials({
          access_token: userToken?.google_token,
        });
      }

      return google.gmail({ version: "v1", auth: this.oauth2Client });
    } catch (error) {
      throw new Error("Failed to initialize Gmail client");
    }
  }

  /**
   * Prepare a batch for the queue: fetch the template and resolve attachment
   * bytes ONCE (the heavy Firebase work), so the queue worker never touches
   * storage. Returns the template HTML and the resolved attachments to embed.
   *
   * This is the enqueue-side counterpart to sendEmail(): it does the shared,
   * once-per-batch work, then the EmailEnqueueService creates the session/logs
   * and enqueues one job per recipient.
   */
  async prepareBatch(
    userId: string,
    templateId: string
  ): Promise<{ html: string; subject: string | null; attachments: EmailAttachment[] }> {
    const template = await this.templateRepository.getTemplateById(templateId, userId);
    if (!template) {
      throw new Error("Template not found");
    }

    const resolved = await this.resolveAttachments(template, userId);
    return {
      html: template.html_content,
      subject: template.subject ?? null,
      attachments: resolved,
    };
  }

  /**
   * Resolve a template's attachments (and the optional default PDF) into base64
   * EmailAttachment objects. Extracted from sendEmail so both the legacy direct
   * send and the new enqueue path share one implementation.
   */
  private async resolveAttachments(
    template: { attachments?: string[] },
    userId: string
  ): Promise<EmailAttachment[]> {
    const resolved: EmailAttachment[] = [];

    if (template.attachments && template.attachments.length > 0) {
      const attachmentsData = await this.attahcmentRepository.findByIds(template.attachments);
      if (!attachmentsData || attachmentsData.length !== template.attachments.length) {
        logger.error("One or more attachment IDs are invalid", { });
        throw new Error("One or more attachment IDs are invalid");
      }
      const buffered = await Promise.all(
        attachmentsData.map((a) => this.attachmentService.getAttachmentBase64(a, userId))
      );
      for (const b of buffered) if (b) resolved.push(b);
    }

    if (resolved.length === 0 && process.env.DEFAULT_ATTACHMENT_ENABLED === "true") {
      try {
        const attachmentDir = process.env.DEFAULT_ATTACHMENT_DIR;
        const attachmentFileName = process.env.DEFAULT_ATTACHMENT_FILE_NAME!;
        if (!attachmentFileName) {
          throw new Error("DEFAULT_ATTACHMENT_FILE_NAME env variable is not set");
        }
        const pdfPath = path.join(process.cwd(), attachmentDir!, attachmentFileName);
        const pdfContent = fs.readFileSync(pdfPath);
        resolved.push({
          filename: attachmentFileName,
          content: pdfContent.toString("base64"),
          mimeType: "application/pdf",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          file_url: `file://${pdfPath}`,
        });
        logger.info("Default attachment added", { pdfPath });
      } catch (error) {
        logger.error("Failed to load default attachment", { error });
      }
    }

    return resolved;
  }

  async sendEmail(
    userId: string,
    templateId: string,
    subject: string,
    recipients: string[],
    local_variables: Array<{ key: string; description: string; id: string; recipient_email?: string; value?: string }>,
    global_variables: Array<{ key: string; value: string; id: string }>
  ) {
    const gmail = await this.getGmailClient(userId);

    const template = await this.templateRepository.getTemplateById(
      templateId,
      userId
    );

    if (!template) {
      throw new Error("Template not found");
    }

    // Load attachments from template
    let attachements: (EmailAttachment | null)[] = [];
    if (template.attachments?.length > 0) {
      const attachmentsData = await this.attahcmentRepository.findByIds(
        template?.attachments
      );
      if (!attachmentsData) {
        logger.error("Unable to find attachments", { templateId });
        throw new Error("Failed to laod attachments");
      }
      if (attachmentsData.length !== template.attachments.length) {
        logger.error("One or more attachment IDs are invalid", { templateId });
        throw new Error("One or more attachment IDs are invalid");
        return;
      }

      const bufferedAttachmentsData = await Promise.all(
        attachmentsData.map((attachment) =>
          this.attachmentService.getAttachmentBase64(attachment, userId)
        )
      );

      attachements = bufferedAttachmentsData;
    }

    // If no template attachments and DEFAULT_ATTACHMENT_ENABLED is true, attach the default local PDF
    if (attachements.length === 0 && process.env.DEFAULT_ATTACHMENT_ENABLED === 'true') {
      try {
        const attachmentDir = process.env.DEFAULT_ATTACHMENT_DIR;
        const attachmentFileName = process.env.DEFAULT_ATTACHMENT_FILE_NAME!;

        if (!attachmentFileName) {
          throw new Error('DEFAULT_ATTACHMENT_FILE_NAME env variable is not set');
        }

        const pdfPath = path.join(process.cwd(), attachmentDir!, attachmentFileName);
        const pdfContent = fs.readFileSync(pdfPath);

        const localPdfAttachment: EmailAttachment = {
          filename: attachmentFileName,
          content: pdfContent.toString('base64'),
          mimeType: 'application/pdf',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          file_url: `file://${pdfPath}`,
        };

        attachements.push(localPdfAttachment);
        logger.info("Default  attachment added", { pdfPath });
      } catch (error) {
        logger.error("Failed to load default attachment", { error });
      }
    }

    // Create session record
    const session = await this.historyRepository.createSession({
      user_id: userId,
      template_id: templateId,
      subject: subject,
      global_variables: global_variables,
      total_emails: recipients.length,
    });

    const emailStatuses: EmailStatus[] = [];
    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      let personalizedHtml = template?.html_content;
      let personalizedSubject = subject;

      if (!isValidEmail(recipient) || !(await checkMXRecord(recipient))) {
        logger.warn("Invalid email detected", { recipient });
        emailStatuses.push({ email: recipient, status: "invalid" });
        failedCount++;

        // Log the invalid email
        await this.historyRepository.createEmailLog({
          session_id: session.id,
          user_id: userId,
          template_id: templateId,
          recipient_email: recipient,
          local_variables: [],
          global_variables: global_variables,
          subject: subject,
          status: "invalid",
        });
        continue;
      }

      // Replace global variables in both HTML and subject
      global_variables.forEach(({ key, value }) => {
        personalizedHtml = replacePlaceholder(personalizedHtml, key, String(value ?? ''));
        personalizedSubject = replacePlaceholder(personalizedSubject, key, String(value ?? ''));
      });

      // Find per-recipient local variables (those with recipient_email; value can be empty)
      const recipientLocalVars = local_variables.filter(
        (v) => v.recipient_email && v.recipient_email === recipient && v.value !== undefined && v.value !== null
      );

      if (recipientLocalVars.length > 0) {
        // Use per-recipient local variable values for replacement in HTML and subject
        recipientLocalVars.forEach(({ key, value }) => {
          personalizedHtml = replacePlaceholder(personalizedHtml, key, String(value ?? ''));
          personalizedSubject = replacePlaceholder(personalizedSubject, key, String(value ?? ''));
        });
      } else {
        // Fallback: extract receiver name from email for {{receiver_name}}
        const receiverName = extractReceiverNameFromEmail(recipient);
        personalizedHtml = replacePlaceholder(personalizedHtml, 'receiver_name', receiverName);
        personalizedSubject = replacePlaceholder(personalizedSubject, 'receiver_name', receiverName);

        // Also apply any generic local variables (without recipient_email)
        local_variables
          .filter((v) => !v.recipient_email)
          .forEach(({ key, value }) => {
            personalizedHtml = replacePlaceholder(personalizedHtml, key, String(value ?? ''));
            personalizedSubject = replacePlaceholder(personalizedSubject, key, String(value ?? ''));
          });
      }
      logger.info("personalized html",personalizedHtml)

      // Replace any remaining unmatched placeholders with empty strings
      personalizedHtml = replaceRemainingPlaceholders(personalizedHtml);
      personalizedSubject = replaceRemainingPlaceholders(personalizedSubject);

      // Clean up empty placeholder sentinels and fix surrounding whitespace
      personalizedHtml = cleanupEmptyPlaceholders(personalizedHtml);
      personalizedSubject = cleanupEmptyPlaceholders(personalizedSubject);

      // Sanitize non-ASCII characters to prevent encoding issues (e.g., em-dash -> garbled text)
      personalizedSubject = sanitizeNonAscii(personalizedSubject);
      personalizedHtml = sanitizeNonAscii(personalizedHtml);

      // Create per-recipient email log with "pending" status
      const recipientVarsForLog = recipientLocalVars.length > 0
        ? recipientLocalVars
        : local_variables.filter((v) => !v.recipient_email || v.recipient_email === recipient);

      const emailLog = await this.historyRepository.createEmailLog({
        session_id: session.id,
        user_id: userId,
        template_id: templateId,
        recipient_email: recipient,
        local_variables: recipientVarsForLog,
        global_variables: global_variables,
        subject: personalizedSubject,
        status: "pending",
      });

      const emailBody = createEmailBody(
        recipient,
        personalizedSubject,
        personalizedHtml,
        attachements
      );

      // Encode the entire message
      const encodedMessage = Buffer.from(emailBody)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

      try {
        logger.info("Sending email via Gmail SDK", { recipient });
        const response = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: encodedMessage },
        });
        logger.info("Gmail SDK response", {
          recipient,
          status: response.status,
          messageId: response.data?.id,
          labelIds: response.data?.labelIds,
        });

        if (response.status === 200) {
          emailStatuses.push({ email: recipient, status: "sent" });
          sentCount++;

          await this.historyRepository.updateEmailLogStatus(emailLog.id, "sent");

          try {
            const firstName = recipientLocalVars.find((v) => v.key === "receiver_name")?.value
              || extractReceiverNameFromEmail(recipient);
            const companyName = global_variables.find((v) => v.key === "company_name")?.value || null;

            // is_valid starts as 'not_verified'; the bounce-scan cron flips it to
            // 'valid' / 'failed' once it inspects the Gmail thread. On re-send we
            // reset it so the address gets re-verified.
            await this.sentEmailRecordsRepository.upsertSent(
              firstName,
              recipient,
              companyName
            );
          } catch (recordErr) {
            logger.error("Failed to insert sent_email_record", { recipient, error: recordErr });
          }

          logger.info("Email sent successfully", {
            recipient,
            messageId: response.data?.id,
          });
        } else {
          logger.warn("Unexpected Gmail response status", { recipient, status: response.status });
          emailStatuses.push({ email: recipient, status: "failed" });
          failedCount++;
          await this.historyRepository.updateEmailLogStatus(emailLog.id, "failed");
        }
      } catch (emailError: any) {
        logger.error("Error while sending email", {
          recipient,
          error: emailError?.message,
          responseStatus: emailError?.response?.status,
          responseData: emailError?.response?.data,
        });
        emailStatuses.push({ email: recipient, status: "failed" });
        failedCount++;

        try {
          await this.historyRepository.updateEmailLogStatus(emailLog.id, "failed");
        } catch (dbError) {
          logger.error("DB update failed for recipient", { recipient, error: dbError });
        }
      }

      // Add a delay between sending emails (2.5 seconds)
      if (recipients.indexOf(recipient) < recipients.length - 1) {
        await delay(2500);
      }
    }

    // Update session with final counts and status
    const finalStatus = sentCount === recipients.length
      ? "completed"
      : failedCount === recipients.length
        ? "failed"
        : "completed";
    await this.historyRepository.updateSessionStatus(session.id, finalStatus, sentCount, failedCount);

    return emailStatuses;
  }
}
