import dns from "dns";
import juice from "juice";
import { EmailAttachment } from "../types/attachment.types";

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

export async function checkMXRecord(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      resolve(!err && addresses.length > 0);
    });
  });
}

/**
 * Extracts receiver name from email address
 * @param email - Email address
 * @returns Extracted name or fallback
 */
export function extractReceiverNameFromEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  try {
    // Get the part before @
    const localPart = email.split('@')[0];

    let name = '';
    // If it contains a dot, return the part before the dot
    if (localPart.includes('.')) {
      name = localPart.split('.')[0];
    } else {
      // Otherwise return the whole local part
      name = localPart;
    }

    // Capitalize the first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch (error) {
    // Return fallback if any error occurs
    return '';
  }
}

/**
 * Sanitizes text by replacing common problematic Unicode characters with ASCII equivalents.
 * Prevents encoding issues like em-dash (—) becoming garbled (Ã¢Â€Â") in emails.
 */
export function sanitizeNonAscii(text: string): string {
  return text
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')   // Smart double quotes -> regular
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")    // Smart single quotes -> regular
    .replace(/\u2014/g, '-')                         // Em-dash -> hyphen
    .replace(/\u2013/g, '-')                         // En-dash -> hyphen
    .replace(/\u2026/g, '...')                       // Ellipsis -> three dots
    .replace(/\u00A0/g, ' ')                         // Non-breaking space -> regular space
    .replace(/\u2022/g, '*')                         // Bullet -> asterisk
    .replace(/[^\x00-\x7F]/g, ' ');                  // Any remaining non-ASCII -> space
}

export function createEmailBody(
  recipient: string,
  subject: string,
  personalizedHtml: string,
  attachmentsData: (EmailAttachment | null)[]
): string {
  let emailBody = `To: ${recipient}\r\n` +
    `Subject: ${subject}\r\n` +
    "MIME-Version: 1.0\r\n" +
    "Content-Type: multipart/mixed; boundary=boundary123\r\n" +
    "\r\n" +
    "--boundary123\r\n" +
    "Content-Type: text/html; charset=\"UTF-8\"\r\n" +
    "Content-Transfer-Encoding: 7bit\r\n" +
    "\r\n" +
    personalizedHtml + "\r\n";

  if (attachmentsData.length !=  0) {
    for (const attachment of attachmentsData) {
      if (!attachment) continue;
      emailBody +=
        "--boundary123\r\n" +
        `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n` +
        `Content-Disposition: attachment; filename="${attachment.filename}"\r\n` +
        "Content-Transfer-Encoding: base64\r\n" +
        "\r\n" +
        attachment.content + "\r\n";
    }
  }
  
  emailBody += "--boundary123--";
  return emailBody;
}

/**
 * Converts Tailwind-based HTML into inline-styled email-safe HTML for Gmail API
 * @param rawHtml - Tailwind HTML string from the editor
 * @returns Base64-encoded, RFC-compliant HTML string ready for Gmail API
 */

const tailwindBaseStyles = `@import url('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');`;

export function convertTailwindHtmlToSendableEmail(rawHtml: string): string {
  // 1. Wrap raw HTML with full email HTML structure

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Email</title>
        <style>
          ${tailwindBaseStyles}
        </style>
      </head>
      <body>
        ${rawHtml}
      </body>
    </html>
  `;

  // 2. Inline styles using Juice
  const inlinedHtml = juice(fullHtml);

  return inlinedHtml;
}

