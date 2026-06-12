/**
 * provider.factory.ts — the single place an LLM provider is registered.
 *
 * Adding a new provider (OpenAI, Anthropic, …):
 *   1. add `your-provider.provider.ts` implementing LLMProvider,
 *   2. add one `case` below,
 *   3. set LLM_PROVIDER=<name> in the env.
 * The agents resolve their provider through getLLMProvider() and never change.
 */
import { env, LLMProvider, logger } from "@app/shared";
import { GeminiProvider } from "./providers/gemini.provider";

let cached: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cached) return cached;

  switch (env.llm.provider) {
    case "gemini":
      cached = new GeminiProvider();
      break;
    default:
      logger.error("[llm] unknown LLM_PROVIDER, falling back to gemini", {
        provider: env.llm.provider,
      });
      cached = new GeminiProvider();
  }

  return cached;
}
