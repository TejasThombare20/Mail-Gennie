/**
 * gemini.provider.ts — LLMProvider implementation backed by Google GenAI.
 *
 * Moved here from the old agents/gemini.client.ts. The forced single-tool-call
 * contract is unchanged: we declare exactly ONE function tool and force the
 * model to call it (functionCallingConfig.mode = "ANY"), then read the parsed
 * args. The provider-neutral ToolSchema maps directly onto Gemini's
 * FunctionDeclaration.parameters.
 */
import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  FunctionDeclaration,
} from "@google/genai";
import {
  env,
  logger,
  LLMProvider,
  ToolCallRequest,
} from "@app/shared";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private client: GoogleGenAI | null = null;

  isConfigured(): boolean {
    return Boolean(env.gemini.apiKey);
  }

  private getClient(): GoogleGenAI {
    if (!env.gemini.apiKey) {
      throw new Error(
        "GEMINI_API_KEY (or GOOGLE_API_KEY) is not set — cannot run the AI agents."
      );
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: env.gemini.apiKey });
    }
    return this.client;
  }

  async callTool<T>(req: ToolCallRequest): Promise<T> {
    const ai = this.getClient();

    // The neutral ToolSchema lines up with Gemini's FunctionDeclaration shape.
    const tool = req.tool as unknown as FunctionDeclaration;

    const response = await ai.models.generateContent({
      model: env.gemini.model,
      contents: req.user,
      config: {
        systemInstruction: req.system,
        temperature: 0,
        tools: [{ functionDeclarations: [tool] }],
        // Force the model to answer by calling our tool, never free text.
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [req.tool.name],
          },
        },
      },
    });

    const call = response.functionCalls?.[0];
    if (!call || call.name !== req.tool.name) {
      logger.error("[gemini] model did not return the expected tool call", {
        tool: req.tool.name,
        got: call?.name,
        text: response.text,
      });
      throw new Error(
        `Gemini did not call the expected tool "${req.tool.name}".`
      );
    }

    return (call.args ?? {}) as T;
  }
}
