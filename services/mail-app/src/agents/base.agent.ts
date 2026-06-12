/**
 * base.agent.ts — shared base for the forced-single-tool-call agents.
 *
 * Encapsulates the pattern both agents duplicate: hold a system instruction +
 * one ToolSchema, optionally append a user "extra prompt" to steer the model,
 * and run the call through whatever LLMProvider is configured. Subclasses just
 * declare their instruction/tool and shape the input/output.
 */
import { LLMProvider, ToolSchema } from "@app/shared";
import { getLLMProvider } from "./provider.factory";

export abstract class Agent<TArgs> {
  protected abstract readonly systemInstruction: string;
  protected abstract readonly tool: ToolSchema;

  /** Provider is injectable for testing; defaults to the configured one. */
  constructor(protected readonly provider: LLMProvider = getLLMProvider()) {}

  /** True when the underlying provider is ready (e.g. API key present). */
  protected isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Run the forced tool call. `extraPrompt`, when present, is appended to the
   * system instruction as an additional steering instruction (rules still win).
   */
  protected async run(userPrompt: string, extraPrompt?: string): Promise<TArgs> {
    const system = extraPrompt?.trim()
      ? `${this.systemInstruction}\n\nADDITIONAL USER INSTRUCTION (steer the output, but keep all rules above):\n${extraPrompt.trim()}`
      : this.systemInstruction;

    return this.provider.callTool<TArgs>({
      system,
      user: userPrompt,
      tool: this.tool,
    });
  }
}
