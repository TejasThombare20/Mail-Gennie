import dns from "dns";
import { EmailAttachment } from "../types/email.types";

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export async function checkMXRecord(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      resolve(!err && !!addresses && addresses.length > 0);
    });
  });
}

/**
 * Extracts a receiver name from an email address.
 * "john.doe@x.com" -> "John", "alice@x.com" -> "Alice".
 */
export function extractReceiverNameFromEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "";
  }
  try {
    const localPart = email.split("@")[0];
    const name = localPart.includes(".") ? localPart.split(".")[0] : localPart;
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "";
  }
}

/**
 * Replaces problematic Unicode chars with ASCII equivalents so emails don't
 * render garbled (e.g. em-dash -> hyphen).
 */
export function sanitizeNonAscii(text: string): string {
  return text
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/—/g, "-")
    .replace(/–/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/•/g, "*")
    .replace(/[^\x00-\x7F]/g, " ");
}

/**
 * Builds a multipart/mixed MIME body (HTML + optional base64 attachments)
 * suitable for the Gmail API `raw` field.
 */
export function createEmailBody(
  recipient: string,
  subject: string,
  personalizedHtml: string,
  attachmentsData: (EmailAttachment | null)[]
): string {
  let emailBody =
    `To: ${recipient}\r\n` +
    `Subject: ${subject}\r\n` +
    "MIME-Version: 1.0\r\n" +
    "Content-Type: multipart/mixed; boundary=boundary123\r\n" +
    "\r\n" +
    "--boundary123\r\n" +
    'Content-Type: text/html; charset="UTF-8"\r\n' +
    "Content-Transfer-Encoding: 7bit\r\n" +
    "\r\n" +
    personalizedHtml +
    "\r\n";

  if (attachmentsData.length !== 0) {
    for (const attachment of attachmentsData) {
      if (!attachment) continue;
      emailBody +=
        "--boundary123\r\n" +
        `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n` +
        `Content-Disposition: attachment; filename="${attachment.filename}"\r\n` +
        "Content-Transfer-Encoding: base64\r\n" +
        "\r\n" +
        attachment.content +
        "\r\n";
    }
  }

  emailBody += "--boundary123--";
  return emailBody;
}
