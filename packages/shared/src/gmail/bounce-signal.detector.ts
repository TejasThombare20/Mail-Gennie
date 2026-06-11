/**
 * BounceSignalDetector — encapsulates the heuristic that decides whether a
 * mail header pair (From, Subject) indicates a delivery-failure / bounce.
 *
 * Pattern: Strategy. The detection rule is wrapped in a class implementing a
 * stable interface, so the pubsub-service and any verification script can swap
 * or extend the heuristic (e.g. provider-specific rules) without touching call
 * sites. The default `HeuristicBounceSignalDetector` is the broad cross-provider
 * rule extracted from the original bounceScan.service.ts.
 */

const MAILER_DAEMON = "mailer-daemon@googlemail.com";

export interface IBounceSignalDetector {
  /** True when the headers indicate a bounce / delivery-failure notification. */
  isBounce(fromHeader: string, subjectHeader?: string): boolean;
}

export class HeuristicBounceSignalDetector implements IBounceSignalDetector {
  private readonly daemonMarkers = [
    "mailer-daemon@",
    "postmaster@",
    MAILER_DAEMON,
    "mail delivery subsystem",
    "mail delivery system",
  ];

  private readonly failurePhrases = [
    "delivery status notification (failure)",
    "delivery status notification",
    "undeliverable",
    "undelivered mail returned",
    "returned mail",
    "failure notice",
    "mail delivery failed",
    "address not found",
    "delivery has failed",
  ];

  isBounce(fromHeader: string, subjectHeader = ""): boolean {
    const from = fromHeader.toLowerCase();
    const subject = subjectHeader.toLowerCase();

    if (this.daemonMarkers.some((marker) => from.includes(marker))) {
      return true;
    }

    return this.failurePhrases.some(
      (phrase) => subject.includes(phrase) || from.includes(phrase)
    );
  }
}

/** Shared default instance — stateless, safe to reuse everywhere. */
export const bounceSignalDetector: IBounceSignalDetector =
  new HeuristicBounceSignalDetector();
