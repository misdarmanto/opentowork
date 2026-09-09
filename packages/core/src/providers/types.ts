export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface ModelConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface MessageParam {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens";

export interface LLMResponse {
  id: string;
  content: ContentBlock[];
  stopReason: StopReason;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ModelInfo {
  name: string;
  contextWindow: number;
  supportsTools: boolean;
  inputCostPer1kTokens: number;
  outputCostPer1kTokens: number;
}

/**
 * Every LLM vendor is called through this interface only. Adding a new
 * provider means implementing this - nothing else in the executor changes.
 */
export interface LLMProvider {
  initialize(config: ProviderConfig): Promise<void>;
  call(
    messages: MessageParam[],
    modelConfig: ModelConfig,
    tools?: ToolSchema[],
    system?: string,
  ): Promise<LLMResponse>;
  calculateCost(inputTokens: number, outputTokens: number, model: string): number;
  getModelInfo(model: string): ModelInfo;
}
