/**
 * ============================================================================
 * send-emails.ts — CLI Script to Send Bulk Emails via the Mail-App API
 * ============================================================================
 *
 * INSTRUCTIONS FOR CLAUDE CODE — FOLLOW THESE STRICTLY:
 * ─────────────────────────────────────────────────────
 * When the user asks you to "send emails" or "run the send email script",
 * follow these steps:
 *
 * 1. GATHER INFORMATION from the user:
 *    - Recipient list: emails (MANDATORY)
 *    - Company name (MANDATORY)
 *    - Portal link: URL to job posting, LinkedIn post, or career portal
 *      - MANDATORY for templates 2 and 3
 *      - OPTIONAL for template 1 (Referral Request)
 *      - NOT NEEDED for template 4 (General Opportunity Exploration)
 *    - Portal name: Name of the portal (OPTIONAL, defaults to "LinkedIn post")
 *      - Only used for templates 2 and 3
 *    - Product info: A short, naturally-phrased description of what the company does or is
 *      known for, used to fill the {{product_info}} placeholder in template 4.
 *      MANDATORY for template 4 only. Passed via --productInfo. The server-side placeholder
 *      key is `product_info`.
 *
 *      The template renders the sentence:
 *        "I'm really impressed by the work {{company_name}} is doing in {{product_info}}."
 *      So the value MUST grammatically fit after "doing in" and read as a natural phrase.
 *
 *      The user will usually give only a brief hint (e.g. "AI-powered finance platform",
 *      "data catalog", "empowering enterprises"). Claude Code MUST expand that hint into
 *      a clean, meaningful phrase using its own knowledge of the company (and a quick
 *      web search if the company is unfamiliar) — do not paste the raw hint verbatim if it
 *      would read awkwardly. If unsure about the company, prefer a safe generic phrasing
 *      over an inaccurate specific claim.
 *
 *      LENGTH LIMIT (HARD):
 *      ─────────────────────
 *      Keep the value between 12 and 20 words. Anything shorter feels generic;
 *      anything longer turns the sentence into a run-on. Count words before sending —
 *      if you're over 20, trim adjectives and clauses until you fit.
 *
 *      ORDER — CORE PRODUCT FIRST, AI SECOND:
 *      ──────────────────────────────────────
 *      The phrase MUST always lead with what the company actually does (their core product /
 *      domain). Do NOT open with AI/ML/GenAI framing unless AI IS the core product (e.g.,
 *      Anthropic, OpenAI, Cohere, a pure-AI startup). For everyone else, mention the AI
 *      angle only as a secondary clause AFTER the core product is established.
 *
 *      The sender's profile is strongly aligned with GenAI / AI engineering, so when the
 *      company has any meaningful AI/ML/LLM/GenAI/agents/RAG/vector-search work, surface it
 *      as the SECOND beat to signal fit — but never at the expense of the core product.
 *      If there is no real AI angle, just write the core-product phrase and stop.
 *
 *      Pattern:
 *        "<core product / domain phrase>, [especially / and] <AI/ML angle if applicable>"
 *
 *      Examples (core first, AI second):
 *        - Stripe: "the payments and financial infrastructure space, especially the ML
 *          systems powering fraud detection and risk"
 *        - Notion: "modern productivity and collaborative workspaces, and the GenAI features
 *          built into Notion AI"
 *        - Google: "search and large-scale distributed systems powering products used by
 *          billions, and the GenAI work across Gemini and DeepMind"
 *        - Anthropic (AI is the core): "frontier AI research and building safe, capable
 *          large language models like Claude"
 *
 *      Bad — leads with AI when it isn't the core:
 *        - Stripe: "the AI and ML space, especially fraud detection and payments"   ← wrong order
 *        - Notion: "GenAI productivity tools and AI-first workspaces"               ← AI first, weak on core
 *
 *      Bad — awkward / ungrammatical after "doing in":
 *        - "AI-powered finance platform"           → reads: "doing in AI-powered finance platform"
 *        - "empowering enterprises to outcomes"   → ungrammatical
 *        - "payments"                              → too terse, no substance
 *    - Job ID / Job link: For template 1 (Referral Request), AT LEAST ONE of the
 *      Job ID (--jobId) or the job link (--portalLink) is required — provide either or both.
 *    - Sender email / --from (optional) — defaults to "iamtejasthombare18@gmail.com".
 *      Do NOT ask the user for the sender email if not provided; use the default.
 *    - Role (optional, defaults to "SDE")
 *    - Template type (optional, defaults to 1 - Referral Request)
 *    - Custom subject (optional, has a sensible default)
 *    - Schedule time / --scheduleAt (OPTIONAL) — when provided, the batch is NOT
 *      sent immediately; it is queued and sent at the given time. See the
 *      "SCHEDULING MAILS" section below for the exact format and timezone rules.
 *
 *    SCHEDULING MAILS (--scheduleAt) — IMPORTANT, READ FULLY:
 *    ────────────────────────────────────────────────────────
 *    The system can schedule a batch for a future time. When the user asks to
 *    "schedule", "send tomorrow at 9", "send at 9am", "send later", etc., pass
 *    --scheduleAt. When the user does NOT mention any time, OMIT it (send now).
 *
 *    TIMEZONE — ALWAYS INDIAN STANDARD TIME (IST, UTC+05:30):
 *      The user is in India. ANY time the user gives ("9am", "tomorrow 6pm",
 *      "14:30") is INDIAN time (IST / Asia/Kolkata, UTC+05:30). You MUST treat
 *      the user's wall-clock time as IST and pass it to --scheduleAt in this
 *      exact form so there is no ambiguity:
 *
 *          --scheduleAt "YYYY-MM-DDTHH:mm:ss+05:30"
 *
 *      The trailing +05:30 is the IST offset and is MANDATORY — it tells the
 *      server the instant unambiguously. Do NOT pass a bare local time without
 *      the offset (it would be interpreted as the server's timezone / UTC and
 *      fire at the wrong hour).
 *
 *      Examples (user is speaking IST):
 *        - "send tomorrow at 9 AM"   and today is 2026-06-11
 *              → --scheduleAt "2026-06-12T09:00:00+05:30"
 *        - "send today at 6:30 PM"   (2026-06-11)
 *              → --scheduleAt "2026-06-11T18:30:00+05:30"
 *        - "schedule for 2 PM on 15 June"
 *              → --scheduleAt "2026-06-15T14:00:00+05:30"
 *
 *      DATE RESOLUTION:
 *        - Resolve relative dates ("today", "tomorrow", "next Monday") against
 *          the CURRENT date in IST. If the resolved IST time is already in the
 *          PAST, do not silently send — tell the user the time has passed and
 *          ask for a future time.
 *        - If the user gives only a time with no date (e.g. "at 9am"), assume the
 *          NEXT occurrence of that time in IST (today if still upcoming, else
 *          tomorrow).
 *
 *      BEHAVIOUR WHEN SCHEDULED:
 *        - The batch is queued with run_at = the scheduled instant. The
 *          queue-service worker sends it at that time WITH the usual 2.5s gap
 *          between recipients.
 *        - The worker must be RUNNING and the machine AWAKE at the scheduled
 *          time. If the laptop is asleep/off, the batch fires when the worker
 *          next comes online (late, never dropped). Mention this to the user
 *          when they schedule for a time the machine may be off.
 *
 *    TEMPLATE SELECTION:
 *    The system supports 5 email templates. Do NOT explicitly ask the user which one to use.
 *    Instead, infer from context or mention the options naturally:
 *      - Template 1 (DEFAULT): "Referral Request" — Cold email asking someone for a referral
 *      - Template 2: "Direct Hiring Manager" — Message to a hiring manager after their LinkedIn post
 *      - Template 3: "Team Member Indirect" — Outreach to a team member to forward resume
 *      - Template 4: "General Opportunity Exploration" — Cold email expressing interest in a company
 *        without a specific job posting, asks for a quick chat. Use this when the user wants to
 *        reach out about general opportunities rather than a specific role/posting.
 *      - Template 5: "Hiring Manager or Forward — Job ID Required" — Cold email to someone who may
 *        or may not be the hiring manager. Includes a specific Job ID, asks them to consider you
 *        directly or forward to the right hiring manager if it's not their team.
 *        Use when: you have a Job ID but don't know if the recipient is the hiring manager.
 *        REQUIRES: --jobId (mandatory). --portalLink is optional.
 *
 *    If the user doesn't specify, use Template 1 by default.
 *    If needed, mention available templates as: "I can use template 1 (referral),
 *    template 2 (direct to manager), template 3 (to team member), template 4 (general exploration),
 *    or template 5 (job ID cold outreach — forward if not your team). Which fits best?"
 *
 *    FIRST NAMES — DO NOT ASK THE USER:
 *    Claude Code must infer each recipient's first name from their email address
 *    using LLM reasoning. For example:
 *      - "thombaretejas44@gmail.com"  → "Tejas"
 *      - "john.doe@company.com"       → "John"
 *      - "alice_smith99@gmail.com"    → "Alice"
 *    Extract the human-readable name portion, capitalize it properly, and use it
 *    as the firstName field. Never prompt the user for first names.
 *
 *    COMMON PITFALLS TO AVOID:
 *      - Single initial + surname patterns: "vsingh@company.com" or "djoshi@company.com"
 *        These follow the pattern of single letter + surname. The initial (v, d, etc.) is
 *        NOT the first name. Use an empty string "" instead since we cannot extract the actual first name.
 *      - Known surnames in isolation: If email only has a surname (Singh, Joshi, Patel, etc.),
 *        without a first name portion, use an empty string "".
 *
 *    If the email address does not contain a recognizable human name
 *    (e.g., "otherfaltuwork23@gmail.com", "xyz123@gmail.com", "noreply@co.com",
 *    "st@company.com", "vsingh@company.com", "djoshi@company.com"),
 *    use an empty string "" as the firstName.
 *    The send email API will automatically remove empty placeholder values from the
 *    template, so greetings like "Hi {{receiver_name}}" become just "Hi" when
 *    the name is empty — keeping the email clean and natural.
 *
 *    MIXED-TEMPLATE BATCHES — "manager" keyword:
 *    ─────────────────────────────────────────────
 *    When a recipient list contains recipients explicitly labelled "manager" next to their
 *    email (e.g. "john.doe@company.com - manager"), split the batch and run TWO commands:
 *
 *      1. The "manager" recipients → always use Template 5.
 *         Template 5 REQUIRES --jobId. If the user has not provided one, ask for it before
 *         proceeding. Do NOT substitute a placeholder; the jobId is mandatory.
 *
 *      2. All remaining (non-manager) recipients → use the template the user specified
 *         (or the default template if none was specified).
 *
 *    Rules:
 *      - The "manager" label is ONLY recognised when the user EXPLICITLY writes the word
 *        "manager" (case-insensitive) next to the email address — e.g.:
 *            john.doe@company.com - manager
 *            jane@company.com  manager
 *            mike@company.com (manager)
 *      - Do NOT infer "manager" from job titles, email patterns, or context clues.
 *        Only the explicit word triggers the split.
 *      - If the user explicitly requests template 5 for the whole list (no "manager" labels),
 *        send all recipients with template 5 in a single command.
 *      - If ALL recipients are labelled "manager", run only the template 5 command.
 *      - If NO recipients are labelled "manager", run a single command with the user's template.
 *      - First names for "manager" recipients are still inferred from the email address
 *        using the same rules as all other recipients — never ask.
 *
 *    Example — mixed list:
 *      User provides:
 *        alice@company.com - manager
 *        bob@company.com - Bob
 *        carol@company.com
 *      Result: run TWO commands —
 *        Command A (template 5): --data '[{"email":"alice@company.com","firstName":"Alice"}]'
 *        Command B (user template): --data '[{"email":"bob@company.com","firstName":"Bob"},{"email":"carol@company.com","firstName":"Carol"}]'
 *
 *    COLLEGE SENIOR OUTREACH:
 *    ────────────────────────
 *    When the user explicitly mentions that they are sending mail to a "college senior"
 *    or "senior from college", apply the following overrides:
 *      - Subject: "IIIT Gwalior college junior here - Referral Request for {{ROLE}} at {{company_name}}"
 *      - First name: Append " Sir" or " Ma'am" to the recipient's first name.
 *        Use " Sir" by default. Use " Ma'am" if the name is clearly feminine
 *        (e.g., Priya, Sneha, Mansi, Nikita, Anusha, Sridevi, etc.).
 *        Examples:
 *          - "naman.lakhwani@company.com" → firstName: "Naman Sir"
 *          - "priya.sharma@company.com"   → firstName: "Priya Ma'am"
 *      - These overrides apply ONLY when the user explicitly indicates college senior context.
 *        Do NOT apply them for regular referral emails.
 *      - IMPORTANT: Do NOT ask the user if they are sending to a college senior.
 *        Do NOT assume college senior context. Only apply these overrides when the
 *        user explicitly and clearly states it themselves (e.g., "this is my college senior",
 *        "sending to senior from college"). If the user does not mention it, treat it
 *        as a normal referral email.
 *
 * 2. BUILD THE COMMAND:
 *    cd /home/tejas/Documents/agentic-ai/mail-app/server
 *    npx ts-node src/scripts/send-emails.ts \
 *      --data '<JSON array of {email, firstName}>' \
 *      --company "<company name>" \
 *      --portalLink "<URL to job posting or LinkedIn post>" \
 *      --from "<sender email>" \
 *      [--portalName "<portal name>"] \
 *      [--jobId "<job ID>"] \
 *      [--productInfo "<expanded product/area phrase>"] \
 *      [--template <1|2|3|4|5>] \
 *      [--role "<role>"] \
 *      [--subject "<custom subject>"] \
 *      [--scheduleAt "YYYY-MM-DDTHH:mm:ss+05:30"]   # IST; omit to send now
 *
 * 3. IMPORTANT NOTES:
 *    - The --data JSON MUST be valid JSON. Each entry needs "email" and "firstName".
 *    - The --portalLink is mandatory and should be a clickable URL.
 *    - The --portalName is optional (defaults to "LinkedIn post"). MANDATORY for templates 2 & 3.
 *      This is used for the {{portal_name}} placeholder in email templates.
 *    - For template 1, at least ONE of --jobId or --portalLink is required (either or both).
 *      --jobId is used for the {{JOB_ID}} placeholder. For templates 2 & 3, --jobId is optional.
 *    - The --subject supports template variables: {{receiver_name}}, {{company_name}},
 *      {{ROLE}}, {{portal_link}}, {{portal_name}}, {{JOB_ID}}, {{product_info}}.
 *      These get replaced per-recipient.
 *    - The server automatically sanitizes non-ASCII characters (em-dashes,
 *      smart quotes, etc.) to their ASCII equivalents before sending, so
 *      encoding issues (like Ã¢Â€Â" garbled text) are handled automatically.
 *    - The server must be running (default: http://localhost:3000).
 *    - The script auto-generates a JWT token by looking up the --from user in the DB.
 *    - QUEUE-BASED SENDING: the API no longer blocks while sending. It enqueues
 *      the batch and returns 202 immediately with { sessionId, queued, scheduledFor }.
 *      The queue-service worker then sends the emails in the background, with a
 *      2.5-second gap between each recipient in the batch (to avoid rate limiting).
 *      => The queue-service worker MUST be running for emails to actually go out:
 *         npm run start --workspace=@app/queue-service
 *    - Track progress via GET /api/email/session/<sessionId>/status.
 *    - --scheduleAt (IST, +05:30) schedules the batch instead of sending now.
 *      See the "SCHEDULING MAILS" section at the top for the exact format.
 *
 * ─────────────────────────────
 * TEMPLATE IDS (Configure in .env or update hardcoded values):
 * ─────────────────────────────
 *   TEMPLATE_ID_1: Referral Request (generic) — Default
 *   TEMPLATE_ID_2: Direct Hiring Manager Outreach
 *   TEMPLATE_ID_3: Team Member Indirect Referral
 *   TEMPLATE_ID_4: General Opportunity Exploration
 *   TEMPLATE_ID_5: Hiring Manager or Forward — Job ID Required
 *
 * ─────────────────────────────
 * ARGUMENTS REFERENCE:
 * ─────────────────────────────
 *
 *   MANDATORY:
 *   ──────────
 *   --data         JSON array of recipients. Format: '[{"email":"alice@google.com","firstName":"Alice"}]'
 *   --company      Company name used for {{company_name}} variable. e.g., "Google"
 *   --from         Sender's email (must exist in the users table). e.g., "me@gmail.com"
 *
 *   CONDITIONALLY MANDATORY:
 *   ───────────────────────
 *   --portalLink   URL to job posting, LinkedIn post, or career portal.
 *                  REQUIRED for templates 2 & 3.
 *                  For template 1, REQUIRED only if --jobId is not provided (at least one needed).
 *                  NOT NEEDED for template 4 (General Opportunity Exploration).
 *                  e.g., "https://linkedin.com/jobs/view/123"
 *   --jobId        Job posting ID for {{JOB_ID}} placeholder. REQUIRED for template 5.
 *                  For template 1, REQUIRED only if --portalLink is not provided (at least one needed).
 *                  Optional for templates 2 & 3.
 *   --productInfo  Value for the {{product_info}} placeholder in template 4. REQUIRED for template 4.
 *                  Must read naturally after "doing in" — Claude expands the user's hint into a full phrase.
 *                  e.g., "the AI-powered finance space, building modern spend management for businesses"
 *
 *   OPTIONAL:
 *   ──────────
 *   --portalName   Portal/posting name for {{portal_name}} placeholder.
 *                  Default: "LinkedIn post"
 *                  REQUIRED for templates 2 & 3 (if not provided, defaults to "LinkedIn post")
 *   --template     Template type: 1 (default), 2, 3, or 4
 *   --subject      Email subject line with template vars.
 *                  Default: "Hi {{receiver_name}} - Referral Request for {{company_name}} {{ROLE}} Role"
 *   --role         Role name for {{ROLE}} variable. Default: "SDE"
 *   --scheduleAt   Schedule the batch for a future time instead of sending now.
 *                  Format: "YYYY-MM-DDTHH:mm:ss+05:30" (IST / Asia/Kolkata).
 *                  The +05:30 IST offset is MANDATORY. Omit this flag to send
 *                  immediately. See "SCHEDULING MAILS" at the top for full rules.
 *                  e.g., "2026-06-12T09:00:00+05:30"  (9 AM IST on 12 June 2026)
 *
 * ─────────────────────────────
 * EXAMPLE INVOCATIONS:
 * ─────────────────────────────
 *
 *   # Template 1 (Referral Request) with 2 recipients:
 *   npx ts-node src/scripts/send-emails.ts \
 *     --data '[{"email":"john@acme.com","firstName":"John"},{"email":"jane@acme.com","firstName":"Jane"}]' \
 *     --company "Acme Corp" \
 *     --portalLink "https://acme.careers/job/sde-1" \
 *     --from "iamtejasthombare@gmail.com" \
 *     --jobId "JOB_12345" \
 *     --portalName "Acme Careers" \
 *     --role "SDE-2"
 *
 *   # Template 2 (Direct to Hiring Manager):
 *   npx ts-node src/scripts/send-emails.ts \
 *     --data '[{"email":"alice@google.com","firstName":"Alice"}]' \
 *     --company "Google" \
 *     --portalLink "https://linkedin.com/posts/alice-hiring-post" \
 *     --from "iamtejasthombare@gmail.com" \
 *     --portalName "LinkedIn post" \
 *     --template 2 \
 *     --role "SDE"
 *
 *   # Template 3 (To Team Member):
 *   npx ts-node src/scripts/send-emails.ts \
 *     --data '[{"email":"bob@microsoft.com","firstName":"Bob"}]' \
 *     --company "Microsoft" \
 *     --portalLink "https://microsoft.careers/job/sde-engineer" \
 *     --from "iamtejasthombare@gmail.com" \
 *     --portalName "Microsoft Careers" \
 *     --template 3 \
 *     --role "SDE-3"
 *
 *   # Template 4 (General Opportunity Exploration):
 *   npx ts-node src/scripts/send-emails.ts \
 *     --data '[{"email":"alice@stripe.com","firstName":"Alice"}]' \
 *     --company "Stripe" \
 *     --productInfo "the payments infrastructure space, powering online businesses worldwide" \
 *     --from "iamtejasthombare@gmail.com" \
 *     --template 4
 *
 *   # Template 5 (Hiring Manager or Forward — Job ID Required):
 *   npx ts-node src/scripts/send-emails.ts \
 *     --data '[{"email":"bob@acme.com","firstName":"Bob"}]' \
 *     --company "Acme Corp" \
 *     --jobId "JOB_12345" \
 *     --from "iamtejasthombare@gmail.com" \
 *     --template 5 \
 *     --role "SDE"
 *
 *   # SCHEDULED send (template 1) for 9 AM IST tomorrow (2026-06-12):
 *   #   The batch is queued now and sent at the scheduled IST time by the worker.
 *   npx ts-node src/scripts/send-emails.ts \
 *     --data '[{"email":"john@acme.com","firstName":"John"}]' \
 *     --company "Acme Corp" \
 *     --portalLink "https://acme.careers/job/sde-1" \
 *     --from "iamtejasthombare@gmail.com" \
 *     --scheduleAt "2026-06-12T09:00:00+05:30"
 *
 * ─────────────────────────────
 * ENVIRONMENT VARIABLES:
 * ─────────────────────────────
 *   Reads .env from server root (DB creds, JWT_SECRET, etc.)
 *   TEMPLATE_ID_1 — Template UUID for Referral Request (default)
 *   TEMPLATE_ID_2 — Template UUID for Direct Hiring Manager
 *   TEMPLATE_ID_3 — Template UUID for Team Member Indirect
 *   TEMPLATE_ID_4 — Template UUID for General Opportunity Exploration
 *   SEND_EMAIL_SERVER_URL  — Override the server URL (default: http://localhost:PORT)
 *
 * ─────────────────────────────
 * WHAT THE SCRIPT DOES:
 * ─────────────────────────────
 *   1. Parses and validates CLI arguments
 *   2. Selects the appropriate template based on --template flag (defaults to 1)
 *   3. Connects to PostgreSQL to look up the sender user
 *   4. Generates a short-lived JWT auth token
 *   5. Builds the API payload with per-recipient local variables and global variables
 *   6. Calls POST /api/email/:templateId with the auth cookie
 *   7. Prints the API response and exits
 * ============================================================================
 */

import dotenv from "dotenv";
import path from "path";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import axios from "axios";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── CONFIG ──────────────────────────────────────────────────────────────────
// Template IDs for different scenarios
// Update these after creating templates in the DB and setting up env vars
const TEMPLATE_IDS = {
  1: process.env.TEMPLATE_ID_1 || "f0e7d259-ff8b-4b87-bece-3dec1ef74f01", // Referral Request (DEFAULT)
  2: process.env.TEMPLATE_ID_2 || "0966bc15-89ea-4f14-8dcc-d2689983dc0b", // Direct Hiring Manager
  3: process.env.TEMPLATE_ID_3 || "102c2224-a673-40fd-a70c-ab8999047ff0", // Team Member Indirect
  4: process.env.TEMPLATE_ID_4 || "55ae68ed-caa7-4f2e-adde-98cc31b4df45", // General Opportunity Exploration
  5: process.env.TEMPLATE_ID_5 || "4a01212e-110d-4835-a06e-28db0afa8d2d",   // Hiring Manager or Forward — Job ID Required
};

const SERVER_URL = process.env.SEND_EMAIL_SERVER_URL || `http://localhost:${process.env.PORT || 8000}`;
const ROLE_DEFAULT = "SDE";
const FROM_DEFAULT = "iamtejasthombare18@gmail.com";
const TEMPLATE_DEFAULT = 1; // Default to Template 1 (Referral Request)

// Per-template default subjects
const SUBJECT_DEFAULTS: Record<number, string> = {
  1: "Referral Request for {{company_name}} {{ROLE}} Role",
  2: "{{ROLE}} Role at {{company_name}}  — Saw Your Post",
  3: "{{ROLE}} Opening on Your Team at {{company_name}}",
  4: "Exploring Opportunities at {{company_name}}",
  5: "{{ROLE}} at {{company_name}} — Reaching Out",
};

// Template descriptions for user reference
const TEMPLATE_DESCRIPTIONS: Record<number, { name: string; description: string }> = {
  1: {
    name: "Referral Request",
    description: "Cold email asking someone for a referral (when you don't know them directly)"
  },
  2: {
    name: "Direct Hiring Manager",
    description: "Message to a hiring manager after seeing their LinkedIn post about an opening"
  },
  3: {
    name: "Team Member Indirect",
    description: "Outreach to a team member (not hiring manager) to forward your resume"
  },
  4: {
    
    name: "General Opportunity Exploration",
    description: "Cold email expressing interest in a company without a specific job posting — asks for a quick chat"
  },
  5: {
    name: "Hiring Manager or Forward — Job ID Required",
    description: "Cold email to a potential hiring manager with a specific Job ID; asks them to forward if it's not their team"
  }
};

// ── TYPES ───────────────────────────────────────────────────────────────────
interface RecipientEntry {
  email: string;
  firstName: string;
}

interface ParsedArgs {
  data: RecipientEntry[];
  company: string;
  portalLink: string;
  portalName: string;
  productInfo: string;
  jobId: string;
  subject: string;
  role: string;
  template: number;
  from: string;
  scheduleAt: string | null; // ISO-8601 with IST offset, or null = send now
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let dataStr = "";
  let company = "";
  let portalLink = "";
  let portalName = "LinkedIn post"; // Default value
  let productInfo = "";
  let jobId = "";
  let subject = "";
  let role = ROLE_DEFAULT;
  let template = TEMPLATE_DEFAULT;
  let from = FROM_DEFAULT;
  let scheduleAt: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--data" && args[i + 1]) {
      dataStr = args[++i];
    } else if (args[i] === "--company" && args[i + 1]) {
      company = args[++i];
    } else if (args[i] === "--portalLink" && args[i + 1]) {
      portalLink = args[++i];
    } else if (args[i] === "--portalName" && args[i + 1]) {
      portalName = args[++i];
    } else if (args[i] === "--productInfo" && args[i + 1]) {
      productInfo = args[++i];
    } else if (args[i] === "--jobId" && args[i + 1]) {
      const rawJob = args[++i];
      // A URL (http/https/www.) is a job LINK; anything else is a job ID.
      const isLink = /^(https?:\/\/|www\.)/i.test(rawJob.trim());
      const label = isLink ? "job link :" : "job Id :";
      jobId = label + "( " + rawJob + " )";
    } else if (args[i] === "--subject" && args[i + 1]) {
      subject = args[++i];
    } else if (args[i] === "--role" && args[i + 1]) {
      role = args[++i];
    } else if (args[i] === "--template" && args[i + 1]) {
      const templateNum = parseInt(args[++i], 10);
      if (![1, 2, 3, 4, 5].includes(templateNum)) {
        console.error("Error: --template must be 1, 2, 3, 4, or 5.");
        process.exit(1);
      }
      template = templateNum;
    } else if (args[i] === "--from" && args[i + 1]) {
      from = args[++i];
    } else if (args[i] === "--scheduleAt" && args[i + 1]) {
      scheduleAt = args[++i];
    }
  }

  // If no custom subject was provided, use the template-specific default
  if (!subject) {
    subject = SUBJECT_DEFAULTS[template];
  }

  if (!dataStr) {
    console.error("Error: --data is required.\nFormat: --data '[{\"email\":\"...\",\"firstName\":\"...\"},...]'");
    process.exit(1);
  }
  if (!company) {
    console.error("Error: --company is required.");
    process.exit(1);
  }
  if (!portalLink && (template === 2 || template === 3) ) {
    console.error("Error: --portalLink is required (URL to job posting, LinkedIn post, or career portal).");
    process.exit(1);
  }

  // Validate template-specific required parameters
  // Template 1 (Referral Request): EITHER a Job ID OR a job link is required (at least one).
  if (template === 1 && !jobId && !portalLink) {
    console.error("Error: template 1 (Referral Request) requires at least one of --jobId or --portalLink (job link).");
    process.exit(1);
  }

  if (template === 4 && !productInfo) {
    console.error("Error: --productInfo is REQUIRED for template 4 (General Opportunity Exploration).");
    process.exit(1);
  }

  if (template === 5 && !jobId) {
    console.error("Error: --jobId is REQUIRED for template 5 (Hiring Manager or Forward).");
    process.exit(1);
  }

  if ((template === 2 || template === 3) && !portalName) {
    console.warn("Warning: --portalName is recommended for templates 2 & 3. Using default: 'LinkedIn post'");
  }

  let data: RecipientEntry[];
  try {
    data = JSON.parse(dataStr);
  } catch {
    console.error("Error: --data must be valid JSON.");
    process.exit(1);
  }

  // Validate each entry
  for (const entry of data) {
    if (!entry.email || !entry.email.includes("@")) {
      console.error(`Error: Invalid or missing email: ${JSON.stringify(entry)}`);
      process.exit(1);
    }
    // firstName can be empty — the API will remove empty placeholders from the template
    if (entry.firstName === undefined || entry.firstName === null) {
      entry.firstName = "";
    }
  }

  // Validate --scheduleAt: must be a parseable date and in the future.
  // Times are expected in IST with a +05:30 offset (see SCHEDULING MAILS above).
  if (scheduleAt) {
    const when = new Date(scheduleAt);
    if (isNaN(when.getTime())) {
      console.error(
        `Error: --scheduleAt is not a valid date: "${scheduleAt}".\n` +
          `Use IST format "YYYY-MM-DDTHH:mm:ss+05:30", e.g. "2026-06-12T09:00:00+05:30".`
      );
      process.exit(1);
    }
    if (!/[+-]\d{2}:?\d{2}$|Z$/.test(scheduleAt)) {
      console.warn(
        `Warning: --scheduleAt "${scheduleAt}" has no timezone offset. ` +
          `It will be interpreted in the SERVER's timezone, which may differ from IST. ` +
          `Append the IST offset "+05:30" to be unambiguous.`
      );
    }
    if (when.getTime() <= Date.now()) {
      console.error(
        `Error: --scheduleAt "${scheduleAt}" is in the past ` +
          `(resolves to ${when.toISOString()}). Provide a future IST time.`
      );
      process.exit(1);
    }
  }

  return { data, company, portalLink, portalName, productInfo, jobId, subject, role, template, from, scheduleAt };
}

/**
 * Generates a short-lived JWT token by looking up the user by email in the DB.
 * This avoids needing to pass auth cookies manually.
 */
async function generateAuthToken(pool: Pool, fromEmail: string): Promise<{ token: string; userId: string }> {
  const result = await pool.query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE email = $1 LIMIT 1",
    [fromEmail]
  );
  if (!result.rowCount || result.rowCount === 0) {
    throw new Error(`No user found with email '${fromEmail}'. Please sign in via the app first.`);
  }

  const user = result.rows[0];
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );

  return { token, userId: user.id };
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  const { data, company, portalLink, portalName, productInfo, jobId, subject, role, template, from, scheduleAt } = parseArgs();

  const templateId = TEMPLATE_IDS[template as keyof typeof TEMPLATE_IDS];
  const templateInfo = TEMPLATE_DESCRIPTIONS[template];

  console.log(`\nSend Emails Script`);
  console.log(`──────────────────────────────────`);
  console.log(`Template        : ${template} - ${templateInfo.name}`);
  console.log(`Description     : ${templateInfo.description}`);
  console.log(`Template ID     : ${templateId}`);
  console.log(`From            : ${from}`);
  console.log(`Company         : ${company}`);
  console.log(`Portal Link     : ${portalLink}`);
  console.log(`Portal Name     : ${portalName}`);
  if (jobId) console.log(`Job ID          : ${jobId}`);
  if (productInfo) console.log(`Product Info    : ${productInfo}`);
  console.log(`Role            : ${role}`);
  console.log(`Subject         : ${subject}`);
  if (scheduleAt) {
    const when = new Date(scheduleAt);
    console.log(`Schedule (raw)  : ${scheduleAt}`);
    console.log(`Schedule (IST)  : ${when.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);
  } else {
    console.log(`Schedule        : send now (queued immediately)`);
  }
  console.log(`Recipients      : ${data.length}`);
  data.forEach((d) => console.log(`  - ${d.firstName || "(no name)"} <${d.email}>`));
  console.log(`──────────────────────────────────\n`);

  // Check if template ID is configured
  if (templateId.includes("_HERE") || templateId === "REPLACE_WITH_YOUR_TEMPLATE_ID") {
    console.error(`Error: Template ${template} ID is not configured. Please set TEMPLATE_ID_${template} in your .env or update the hardcoded value in the script.`);
    process.exit(1);
  }

  const dbPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  try {
    const { token } = await generateAuthToken(dbPool, from);

    // Build per-recipient local_variables with recipient_email and value
    const local_variables = data.map((entry, idx) => ({
      key: "receiver_name",
      description: "Recipient first name",
      id: `local_${idx}`,
      recipient_email: entry.email,
      value: entry.firstName,
    }));

    const global_variables = [
      { key: "company_name", value: company, id: "global_company" },
      { key: "ROLE", value: role, id: "global_role" },
      { key: "portal_link", value: portalLink, id: "global_portal" },
      { key: "portal_name", value: portalName, id: "global_portal_name" },
    ];

    // Add JOB_ID only if provided (mandatory for template 1, optional for others)
    if (jobId) {
      global_variables.push({ key: "JOB_ID", value: jobId, id: "global_job_id" });
    }

    // Add product_info for template 4 (General Opportunity Exploration)
    if (productInfo) {
      global_variables.push({ key: "product_info", value: productInfo, id: "global_product_info" });
    }

    const recipients = data.map((d) => d.email);

    const payload: {
      recipients: string[];
      local_variables: typeof local_variables;
      global_variables: typeof global_variables;
      subject: string;
      scheduledAt?: string;
    } = {
      recipients,
      local_variables,
      global_variables,
      subject,
    };

    // Schedule the batch for a future IST time, if requested.
    if (scheduleAt) {
      payload.scheduledAt = new Date(scheduleAt).toISOString();
    }

    console.log(scheduleAt ? "Scheduling email batch...\n" : "Queuing email batch...\n");

    const response = await axios.post(
      `${SERVER_URL}/api/email/${templateId}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Cookie: `auth_token=${token}`,
        },
        timeout: 300000, // 5 min timeout for large batches
      }
    );

    console.log("API Response:", JSON.stringify(response.data, null, 2));
    console.log("\nDone!");
  } catch (err: any) {
    if (err.response) {
      console.error("API Error:", err.response.status, JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Error:", err.message);
    }
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

main();
