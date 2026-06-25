/*
 * Backfill for the pubsub-era window (sent_at >= 2026-06-11) where the stale
 * queue worker never stored send-ids and the TZ bug dropped reply attribution.
 *
 * For each email_log missing ids:
 *   1. Find the matching Gmail SENT message -> backfill thread_id /
 *      gmail_message_id / rfc822_message_id (only where currently NULL).
 *   2. Scan that thread for genuine human replies -> record via
 *      InboxEventRepository.markReplied (idempotent: @> dedupe on responded_at).
 *
 * Bounces are NOT re-marked here: markBounced increments session.failed_count
 * and the bounce-scan cron already handled them. We only ADD missing data.
 *
 * DRY_RUN=true (default) prints the plan and writes nothing.
 */
const {
  GmailClientFactory,
  TokenRepository,
  InboxEventRepository,
  bounceSignalDetector,
  getPool,
} = require("@app/shared");

const DRY_RUN = process.env.DRY_RUN !== "false";
const SINCE = "2026-06-11";

const addrFrom = (v) => {
  const m = (v || "").match(/<([^>]+)>/);
  return (m ? m[1] : v || "").trim().toLowerCase();
};
const hdr = (msg, n) =>
  (msg.payload?.headers?.find((h) => h.name?.toLowerCase() === n) || {}).value || "";

(async () => {
  const pool = getPool();
  const inbox = new InboxEventRepository(pool);
  const factory = new GmailClientFactory(new TokenRepository(pool));
  const gmailByUser = new Map();
  const getGmail = async (uid) => {
    if (!gmailByUser.has(uid)) gmailByUser.set(uid, await factory.createForUser(uid));
    return gmailByUser.get(uid);
  };

  const { rows } = await pool.query(
    `SELECT id, user_id, session_id, recipient_email, status, sent_at, thread_id
     FROM email_logs
     WHERE sent_at >= $1 AND thread_id IS NULL
     ORDER BY sent_at, id`,
    [SINCE]
  );
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY"} | candidate rows: ${rows.length}\n`);

  let idsFilled = 0, idsNoMatch = 0, repliesFound = 0, repliesWritten = 0;

  for (const r of rows) {
    const gmail = await getGmail(r.user_id);
    const R = r.recipient_email.toLowerCase();

    // 1) locate our sent message to this recipient, closest in time to sent_at
    let list;
    try {
      list = await gmail.users.messages.list({ userId: "me", q: `in:sent to:${R}`, maxResults: 10 });
    } catch (e) { console.log(`  [${r.id}] ${R}: list error ${e.message}`); continue; }
    const cand = list.data.messages ?? [];
    if (!cand.length) { idsNoMatch++; console.log(`  [${r.id}] ${R}: NO sent message found`); continue; }

    const target = new Date(r.sent_at).getTime();
    let best = null;
    for (const c of cand) {
      const meta = await gmail.users.messages.get({
        userId: "me", id: c.id, format: "metadata", metadataHeaders: ["Message-Id"],
      });
      const dt = Math.abs(Number(meta.data.internalDate) - target);
      if (!best || dt < best.dt) {
        best = { dt, messageId: meta.data.id, threadId: meta.data.threadId, rfc822: hdr(meta.data, "message-id") || null };
      }
    }

    idsFilled++;
    console.log(`  [${r.id}] ${R}: thread=${best.threadId} msg=${best.messageId} rfc=${best.rfc822 ? "yes" : "no"}`);
    if (!DRY_RUN) {
      await pool.query(
        `UPDATE email_logs
           SET gmail_message_id = COALESCE(gmail_message_id,$2),
               thread_id        = COALESCE(thread_id,$3),
               rfc822_message_id= COALESCE(rfc822_message_id,$4)
         WHERE id = $1`,
        [r.id, best.messageId, best.threadId, best.rfc822]
      );
    }

    // 2) scan the thread for genuine human replies
    const th = await gmail.users.threads.get({
      userId: "me", id: best.threadId, format: "metadata",
      metadataHeaders: ["From", "Subject"],
    });
    for (const m of th.data.messages ?? []) {
      const labels = m.labelIds ?? [];
      if (labels.includes("SENT") || labels.includes("DRAFT")) continue;
      const from = hdr(m, "From");
      if (bounceSignalDetector.isBounce(from, hdr(m, "Subject"))) continue; // bounce, not a reply
      const fromAddr = addrFrom(from);
      if (!fromAddr || !fromAddr.includes("@")) continue;
      // a reply we care about: from the original recipient
      if (fromAddr !== R) continue;

      const respondedAt = m.internalDate
        ? new Date(Number(m.internalDate)).toISOString()
        : new Date().toISOString();
      const snippet = (m.snippet || "").trim();
      repliesFound++;
      console.log(`        REPLY from ${fromAddr} @ ${respondedAt} :: "${snippet.slice(0, 80)}"`);
      if (!DRY_RUN) {
        await inbox.markReplied(r.id, R, snippet, respondedAt);
        repliesWritten++;
      }
    }
  }

  console.log(`\n=== SUMMARY (${DRY_RUN ? "dry-run" : "applied"}) ===`);
  console.log(`ids backfilled : ${idsFilled}  | no sent msg: ${idsNoMatch}`);
  console.log(`replies found  : ${repliesFound} | replies written: ${repliesWritten}`);
  await pool.end();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
