import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  LLMProvider,
  LLMResponse,
  MessageParam,
  ModelConfig,
  ModelInfo,
  ProviderConfig,
  StopReason,
  ToolSchema,
} from "./types.js";

const PRICING_PER_1K: Record<string, [number, number]> = {
  "claude-sonnet-4": [0.003, 0.015],
  "claude-3-5-sonnet": [0.003, 0.015],
  "claude-3-5-haiku": [0.0008, 0.004],
  "claude-3-opus": [0.015, 0.075],
};

export class AnthropicProvider implements LLMProvider {
  private client!: Anthropic;

  async initialize(config: ProviderConfig): Promise<void> {
    this.client = new Anthropic({ apiKey: config.apiKey, timeout: config.timeout });
  }

  async call(messages: MessageParam[], modelConfig: ModelConfig, tools?: ToolSchema[]): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: modelConfig.model,
      max_tokens: modelConfig.maxTokens ?? 4096,
      temperature: modelConfig.temperature,
      top_p: modelConfig.topP,
      tools: tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content as Anthropic.MessageParam["content"],
      })),
    });

    return {
      id: response.id,
      content: response.content as unknown as ContentBlock[],
      stopReason: this.mapStopReason(response.stop_reason),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  calculateCost(inputTokens: number, outputTokens: number, model: string): number {
    const [inPrice, outPrice] = PRICING_PER_1K[model] ?? [0, 0];
    return (inputTokens / 1000) * inPrice + (outputTokens / 1000) * outPrice;
  }

  getModelInfo(model: string): ModelInfo {
    const [inputCostPer1kTokens, outputCostPer1kTokens] = PRICING_PER_1K[model] ?? [0, 0];
    return {
      name: model,
      contextWindow: 200_000,
      supportsTools: true,
      inputCostPer1kTokens,
      outputCostPer1kTokens,
    };
  }

  private mapStopReason(reason: string | null): StopReason {
    if (reason === "tool_use") return "tool_use";
    if (reason === "max_tokens") return "max_tokens";
    return "end_turn";
  }
}
