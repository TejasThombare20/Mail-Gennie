/**
 * product-info.agent.ts — AI agent that produces the {{product_info}} phrase for
 * template 4 (General Opportunity Exploration), via a forced Gemini tool call.
 *
 * The phrase is dropped into the sentence:
 *   "I'm really impressed by the work {{company_name}} is doing in {{product_info}}."
 * so it MUST read naturally after "doing in".
 *
 * It encodes the same rules documented in `src/scripts/send-emails.ts`:
 *   - 12-20 words, no run-ons.
 *   - Core product / domain FIRST; AI/ML angle only as a SECOND clause, and only
 *     when AI is genuinely part of the company's work (lead with AI only for
 *     pure-AI companies like Anthropic/OpenAI).
 *   - Must grammatically follow "doing in".
 *
 * The model is FORCED to call `set_product_info`, returning a single string.
 */
import { logger, SchemaType, ToolSchema } from "@app/shared";
import { Agent } from "./base.agent";

const SYSTEM_INSTRUCTION = `You write the {{product_info}} phrase for a cold outreach email. You MUST answer by calling the "set_product_info" tool — never reply with plain text.

The phrase fills this sentence:
  "I'm really impressed by the work <COMPANY> is doing in <product_info>."
So it MUST read as a natural, grammatical continuation after "doing in".

RULES (follow exactly):
- LENGTH: between 12 and 20 words. Shorter feels generic; longer becomes a run-on. Count before answering.
- ORDER — CORE PRODUCT FIRST, AI SECOND: lead with what the company actually does (their core product/domain). Mention an AI/ML/LLM/GenAI/agents/RAG angle only as a SECOND clause, and only if it is genuinely part of their work. Lead with AI ONLY for pure-AI companies (Anthropic, OpenAI, Cohere, a pure-AI startup).
- The sender's profile is strongly aligned with GenAI / AI engineering, so when the company has meaningful AI/ML work, surface it as the second beat to signal fit — but never at the expense of the core product. If there is no real AI angle, just write the core-product phrase and stop.
- Pattern: "<core product / domain phrase>, [especially / and] <AI/ML angle if applicable>".
- Use your own knowledge of the company. If a hint is given, EXPAND it into a clean phrase — do not paste it verbatim if it reads awkwardly. If unsure about the company, prefer a safe generic phrasing over an inaccurate specific claim.
- Do NOT start with "AI-powered ...". Do NOT produce ungrammatical fragments. Do NOT be terse (e.g. just "payments").

GOOD examples:
- Stripe: "the payments and financial infrastructure space, especially the ML systems powering fraud detection and risk"
- Notion: "modern productivity and collaborative workspaces, and the GenAI features built into Notion AI"
- Anthropic (AI is the core): "frontier AI research and building safe, capable large language models like Claude"

Return exactly one phrase in the "productInfo" field.`;

const TOOL: ToolSchema = {
  name: "set_product_info",
  description:
    'The {{product_info}} phrase that completes "...is doing in <product_info>." (12-20 words, core product first).',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      productInfo: {
        type: SchemaType.STRING,
        description:
          'A natural 12-20 word phrase that reads correctly after "doing in".',
      },
    },
    required: ["productInfo"],
  },
};

/** Agent that writes the {{product_info}} phrase via a forced tool call. */
class ProductInfoAgent extends Agent<{ productInfo: string }> {
  protected readonly systemInstruction = SYSTEM_INSTRUCTION;
  protected readonly tool = TOOL;

  async generate(
    companyName: string,
    hint?: string,
    extraPrompt?: string
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      logger.warn("[product-info agent] LLM not configured — cannot generate.");
      return null;
    }

    const userPrompt = JSON.stringify({
      company: companyName,
      hint: hint || "",
    });

    try {
      const { productInfo } = await this.run(userPrompt, extraPrompt);
      const value = (productInfo ?? "").trim();
      return value || null;
    } catch (err) {
      logger.error("[product-info agent] failed", {
        error: (err as Error).message,
      });
      return null;
    }
  }
}

const productInfoAgent = new ProductInfoAgent();

/**
 * Generate the product_info phrase for a company. Thin wrapper kept so existing
 * callers (AgentEnrichmentService) don't change.
 *
 * @param companyName  The company the email targets.
 * @param hint         Optional short hint the user typed (e.g. "data catalog").
 * @param extraPrompt  Optional global UI instruction to steer the phrasing.
 * @returns the phrase, or null when the LLM is unavailable/errors (caller decides
 *          how to handle — template 4 requires it, so the caller will surface it).
 */
export async function generateProductInfo(
  companyName: string,
  hint?: string,
  extraPrompt?: string
): Promise<string | null> {
  return productInfoAgent.generate(companyName, hint, extraPrompt);
}
