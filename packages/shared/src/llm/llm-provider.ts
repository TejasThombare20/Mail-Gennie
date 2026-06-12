/**
 * LLMProvider — the provider-neutral port the agents depend on instead of a
 * concrete SDK. Onboarding a new provider (OpenAI, Anthropic, …) means adding a
 * new implementation of THIS interface; the agents never change.
 *
 * The contract is deliberately narrow: a single forced tool call. Every agent
 * here declares exactly one tool and forces the model to answer by calling it,
 * then reads structured args — so this is the only LLM capability we expose.
 *
 * Note: this file imports NO provider SDK, so @app/shared stays SDK-free. The
 * concrete implementations live in the service that owns the SDK dependency.
 */

/**
 * Provider-neutral JSON-schema type names for tool parameters. The string values
 * match both JSON-Schema and Gemini's Type enum, so agents declare schemas
 * without importing any provider SDK.
 */
export const SchemaType = {
  OBJECT: "OBJECT",
  STRING: "STRING",
  ARRAY: "ARRAY",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
} as const;
export type SchemaType = (typeof SchemaType)[keyof typeof SchemaType];

/** A provider-neutral function-tool the model is forced to call. */
export interface ToolSchema {
  name: string;
  description: string;
  /** JSON-schema-style parameter object (provider adapters map it to their SDK). */
  parameters: Record<string, unknown>;
}

/** One forced-tool-call request. */
export interface ToolCallRequest {
  /** The agent's role + rules (the system prompt). */
  system: string;
  /** The concrete task input (e.g. the recipient list as JSON). */
  user: string;
  /** The single tool the model MUST call. */
  tool: ToolSchema;
}

export interface LLMProvider {
  /** Provider identifier, e.g. "gemini" / "openai" (for logging/diagnostics). */
  readonly name: string;
  /** True when this provider has the config it needs (e.g. an API key). */
  isConfigured(): boolean;
  /**
   * Run a one-shot forced single-tool call and return the parsed tool arguments
   * typed as T. Throws if the model fails to call the expected tool.
   */
  callTool<T>(req: ToolCallRequest): Promise<T>;
}
