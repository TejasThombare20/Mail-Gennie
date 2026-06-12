import { gmail_v1 } from "googleapis";
import { bounceSignalDetector } from "@app/shared";

/**
 * Header helpers + message classification strategies.
 *
 * Pattern: Strategy. Each detector implements IMessageDetector and inspects a
 * Gmail message's headers to classify it. The history processor runs the
 * registered detectors over each changed message.
 */

export type MessageKind = "bounce" | "reply" | "other";

export interface ClassifiedMessage {
  kind: MessageKind;
  /** For a reply/bounce, the address this relates to (the original recipient). */
  relatedAddress: string | null;
}

function header(msg: gmail_v1.Schema$Message, name: string): string {
  return (
    msg.payload?.headers
      ?.find((h) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}

/** Extract a bare email address from a header value like `"Name <a@b.com>"`. */
function extractAddress(headerValue: string): string | null {
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  const bare = headerValue.trim().toLowerCase();
  return bare.includes("@") ? bare : null;
}

export interface IMessageDetector {
  classify(msg: gmail_v1.Schema$Message): ClassifiedMessage | null;
}

/**
 * BounceDetector — reuses the shared bounce-signal heuristic. The related
 * address is parsed out of the failure body's headers where available; callers
 * fall back to thread inspection to attribute it.
 */
export class BounceDetector implements IMessageDetector {
  classify(msg: gmail_v1.Schema$Message): ClassifiedMessage | null {
    const from = header(msg, "From");
    const subject = header(msg, "Subject");
    if (bounceSignalDetector.isBounce(from, subject)) {
      // The original recipient is often in "X-Failed-Recipients" or the body;
      // we expose null here and let the processor attribute via the thread.
      const failed = header(msg, "X-Failed-Recipients");
      return { kind: "bounce", relatedAddress: extractAddress(failed) };
    }
    return null;
  }
}

/**
 * ReplyDetector — an inbound message (not from us, not a daemon) whose From is a
 * human is treated as a reply. The related address is the sender (the person who
 * replied = our original recipient).
 */
export class ReplyDetector implements IMessageDetector {
  constructor(private selfAddress: string) {}

  classify(msg: gmail_v1.Schema$Message): ClassifiedMessage | null {
    const labels = msg.labelIds ?? [];
    // Only inbound mail; skip our own sent copies and drafts.
    if (!labels.includes("INBOX") || labels.includes("SENT")) return null;

    const from = header(msg, "From");
    const fromAddr = extractAddress(from);
    if (!fromAddr || fromAddr === this.selfAddress.toLowerCase()) return null;

    // A daemon message is a bounce, not a human reply — let BounceDetector win.
    if (bounceSignalDetector.isBounce(from, header(msg, "Subject"))) return null;

    return { kind: "reply", relatedAddress: fromAddr };
  }
}
