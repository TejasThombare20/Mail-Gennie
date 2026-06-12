import { Variable } from "../types/email.types";
import { extractReceiverNameFromEmail, sanitizeNonAscii } from "./email.utils";

const EMPTY_SENTINEL = "%%EMPTY%%";

/**
 * TemplateRenderer — encapsulates the placeholder-substitution pipeline that
 * turns a template's raw HTML + subject into a personalized, ASCII-safe email
 * for one recipient.
 *
 * Extracted verbatim (behaviour-preserving) from email.service.ts so both the
 * API and the queue worker render emails identically. Stateless — one shared
 * instance is fine.
 */
export class TemplateRenderer {
  /** Replace {{key}} with value, or a sentinel when the value is empty. */
  private replacePlaceholder(text: string, key: string, value: string): string {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    if (value && value.trim().length > 0) {
      return text.replace(regex, value);
    }
    return text.replace(regex, EMPTY_SENTINEL);
  }

  /** Strip empty-placeholder sentinels and tidy whitespace/punctuation. */
  private cleanupEmptyPlaceholders(text: string): string {
    text = text.replace(new RegExp(`\\s*${EMPTY_SENTINEL}\\s*`, "g"), "");
    text = text.replace(/\s+([,.!?;:])/g, "$1");
    text = text.replace(/\s{2,}/g, " ");
    return text.trim();
  }

  /** Any remaining {{...}} become sentinels (later cleaned). */
  private replaceRemainingPlaceholders(text: string): string {
    return text.replace(/\{\{[^}]+\}\}/g, EMPTY_SENTINEL);
  }

  /**
   * Render one recipient's subject + HTML.
   *
   * @returns the finalized { html, subject, localVarsUsed } where localVarsUsed
   *          are the local variables actually applied for this recipient (used
   *          for logging / record upsert).
   */
  render(params: {
    html: string;
    subject: string;
    recipient: string;
    localVariables: Variable[];
    globalVariables: Variable[];
  }): { html: string; subject: string; localVarsUsed: Variable[] } {
    let html = params.html;
    let subject = params.subject;

    // Global variables first.
    params.globalVariables.forEach(({ key, value }) => {
      html = this.replacePlaceholder(html, key, String(value ?? ""));
      subject = this.replacePlaceholder(subject, key, String(value ?? ""));
    });

    // Per-recipient local variables (those addressed to this recipient).
    const recipientLocalVars = params.localVariables.filter(
      (v) =>
        v.recipient_email &&
        v.recipient_email === params.recipient &&
        v.value !== undefined &&
        v.value !== null
    );

    let localVarsUsed: Variable[];
    if (recipientLocalVars.length > 0) {
      recipientLocalVars.forEach(({ key, value }) => {
        html = this.replacePlaceholder(html, key, String(value ?? ""));
        subject = this.replacePlaceholder(subject, key, String(value ?? ""));
      });
      localVarsUsed = recipientLocalVars;
    } else {
      // Fallback: derive {{receiver_name}} from the email, apply generic locals.
      const receiverName = extractReceiverNameFromEmail(params.recipient);
      html = this.replacePlaceholder(html, "receiver_name", receiverName);
      subject = this.replacePlaceholder(subject, "receiver_name", receiverName);

      params.localVariables
        .filter((v) => !v.recipient_email)
        .forEach(({ key, value }) => {
          html = this.replacePlaceholder(html, key, String(value ?? ""));
          subject = this.replacePlaceholder(subject, key, String(value ?? ""));
        });

      localVarsUsed = params.localVariables.filter(
        (v) => !v.recipient_email || v.recipient_email === params.recipient
      );
    }

    // Remove any leftover placeholders, clean whitespace, force ASCII.
    html = this.cleanupEmptyPlaceholders(this.replaceRemainingPlaceholders(html));
    subject = this.cleanupEmptyPlaceholders(
      this.replaceRemainingPlaceholders(subject)
    );
    html = sanitizeNonAscii(html);
    subject = sanitizeNonAscii(subject);

    return { html, subject, localVarsUsed };
  }
}

export const templateRenderer = new TemplateRenderer();
