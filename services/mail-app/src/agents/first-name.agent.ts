/**
 * first-name.agent.ts — AI agent that derives each recipient's first name from
 * their email address (and an optional per-recipient hint), via a forced Gemini
 * tool call.
 *
 * It encodes the SAME firstName rules documented at the top of
 * `src/scripts/send-emails.ts`, so the UI and the CLI produce identical names:
 *   - "thombaretejas44@gmail.com"  -> "Tejas"
 *   - "john.doe@company.com"       -> "John"
 *   - "vsingh@company.com"         -> ""   (single initial + surname)
 *   - "noreply@co.com"             -> ""   (no human name)
 *   - college-senior hint          -> "Naman Sir" / "Priya Ma'am"
 *
 * The model is FORCED to return its answer by calling `set_first_names`, so we
 * read structured args instead of parsing prose.
 */
import {
  extractReceiverNameFromEmail,
  logger,
  SchemaType,
  ToolSchema,
} from "@app/shared";
import { Agent } from "./base.agent";

/** Input for one recipient: the email plus an optional free-text hint. */
export interface FirstNameInput {
  email: string;
  /**
   * Optional per-recipient context the user typed (e.g. "college senior",
   * "manager", "her name is Priya"). Injected verbatim into the prompt.
   */
  extraInfo?: string;
}

export interface FirstNameResult {
  email: string;
  firstName: string;
}

const SYSTEM_INSTRUCTION = `You generate the FIRST NAME to greet each email recipient with, inferred from their email address and an optional hint. You MUST answer by calling the "set_first_names" tool — never reply with plain text.

RULES (follow exactly):
- Extract the human-readable name portion from the local part of the email, capitalize it properly, and use it as firstName.
  - "thombaretejas44@gmail.com" -> "Tejas"
  - "john.doe@company.com"      -> "John"
  - "alice_smith99@gmail.com"   -> "Alice"
- Single initial + surname patterns: "vsingh@company.com", "djoshi@company.com" — the leading single letter is NOT a first name. Use "".
- A surname alone with no first-name portion (Singh, Joshi, Patel, etc.) -> "".
- No recognizable human name ("noreply@co.com", "xyz123@gmail.com", "st@company.com", "otherfaltuwork23@gmail.com") -> "".
- Output ONLY the name (and any honorific from the rules below). Do not add greetings, punctuation, or extra words.

PER-RECIPIENT HINT (when provided for a recipient):
- The hint may directly state the person's name ("her name is Priya", "this is Rohan") — trust it over the email guess.
- COLLEGE SENIOR ("college senior", "senior from college"): append " Sir" or " Ma'am" to the first name. Default " Sir"; use " Ma'am" if the name is clearly feminine (Priya, Sneha, Mansi, Nikita, Anusha, Sridevi, etc.).
    - "naman.lakhwani@company.com" + "college senior" -> "Naman Sir"
    - "priya.sharma@company.com"   + "college senior" -> "Priya Ma'am"
- "manager" or other role hints do NOT change the first name — still infer the name normally and use "" if none is recognizable.
- If after applying the hint there is still no usable name, use "".

Return one entry per input recipient, preserving the exact email string.`;

const TOOL: ToolSchema = {
  name: "set_first_names",
  description:
    "Return the resolved first name (with any honorific) for every recipient.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      recipients: {
        type: SchemaType.ARRAY,
        description: "One entry per input recipient, in any order.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            email: {
              type: SchemaType.STRING,
              description: "The recipient email, copied exactly from the input.",
            },
            firstName: {
              type: SchemaType.STRING,
              description:
                'The greeting name (e.g. "Tejas", "Naman Sir"), or "" when none can be inferred.',
            },
          },
          required: ["email", "firstName"],
        },
      },
    },
    required: ["recipients"],
  },
};

/**
 * Local, deterministic fallback used when Gemini is not configured or errors.
 * Reuses the shared heuristic so we still send something sensible.
 */
function heuristicFirstNames(inputs: FirstNameInput[]): FirstNameResult[] {
  return inputs.map(({ email }) => ({
    email,
    firstName: extractReceiverNameFromEmail(email) || "",
  }));
}

/** Agent that resolves recipient first names via a forced tool call. */
class FirstNameAgent extends Agent<{ recipients: FirstNameResult[] }> {
  protected readonly systemInstruction = SYSTEM_INSTRUCTION;
  protected readonly tool = TOOL;

  async generate(
    inputs: FirstNameInput[],
    extraPrompt?: string
  ): Promise<FirstNameResult[]> {
    if (inputs.length === 0) return [];

    if (!this.isConfigured()) {
      logger.warn("[first-name agent] LLM not configured — using heuristic.");
      return heuristicFirstNames(inputs);
    }

    const userPrompt = JSON.stringify(
      inputs.map((r) => ({ email: r.email, hint: r.extraInfo || "" }))
    );

    try {
      const { recipients } = await this.run(userPrompt, extraPrompt);

      // Map results back by email so order/missing entries can't corrupt the batch.
      const byEmail = new Map(
        (recipients ?? []).map((r) => [r.email, (r.firstName ?? "").trim()])
      );
      return inputs.map(({ email }) => ({
        email,
        firstName: byEmail.has(email)
          ? byEmail.get(email)!
          : extractReceiverNameFromEmail(email) || "",
      }));
    } catch (err) {
      logger.error("[first-name agent] failed — falling back to heuristic", {
        error: (err as Error).message,
      });
      return heuristicFirstNames(inputs);
    }
  }
}

const firstNameAgent = new FirstNameAgent();

/**
 * Generate first names for a batch of recipients. Thin wrapper kept so existing
 * callers (AgentEnrichmentService) don't change.
 *
 * @param inputs       recipients (+ optional per-recipient hints)
 * @param extraPrompt  optional global instruction the user typed in the UI; it
 *                     is appended to the system instruction so the user can
 *                     steer naming for the whole batch.
 */
export async function generateFirstNames(
  inputs: FirstNameInput[],
  extraPrompt?: string
): Promise<FirstNameResult[]> {
  return firstNameAgent.generate(inputs, extraPrompt);
}
