/**
 * Queue naming contract shared between the enqueue side (mail-app) and the
 * worker side (queue-service). Keeping these here guarantees both agree on task
 * names and on the per-session serial-queue convention.
 */

/** graphile-worker task identifiers. */
export const TASK_SEND_EMAIL = "send_email";

/** Seconds enforced between two sends within the same session. */
export const SEND_GAP_SECONDS = 2.5;

/**
 * Per-session serial queue name. graphile-worker runs jobs sharing a queueName
 * strictly one-at-a-time, while different queueNames run in parallel — so this
 * makes one session's mails serial (with the gap) yet lets sessions overlap.
 */
export function sessionQueueName(sessionId: string): string {
  return `session_${sessionId}`;
}
