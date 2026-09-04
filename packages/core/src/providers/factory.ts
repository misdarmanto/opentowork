import type { LLMProvider, LLMResponse, MessageParam, ModelConfig, ProviderConfig, ToolSchema } from "./types.js";

export class ProviderFactory {
  private providers = new Map<string, LLMProvider>();
  private configs = new Map<string, ProviderConfig>();
  private initialized = new Set<string>();

  register(name: string, provider: LLMProvider, config: ProviderConfig): void {
    this.providers.set(name, provider);
    this.configs.set(name, config);
  }

  async get(name: string): Promise<LLMProvider> {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider "${name}" not registered`);

    if (!this.initialized.has(name)) {
      await provider.initialize(this.configs.get(name)!);
      this.initialized.add(name);
    }
    return provider;
  }

  async call(
    providerName: string,
    messages: MessageParam[],
    modelConfig: ModelConfig,
    tools?: ToolSchema[],
  ): Promise<LLMResponse> {
    const provider = await this.get(providerName);
    return provider.call(messages, modelConfig, tools);
  }

  calculateCost(providerName: string, inputTokens: number, outputTokens: number, model: string): number {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Provider "${providerName}" not registered`);
    return provider.calculateCost(inputTokens, outputTokens, model);
  }
}

export const providerFactory = new ProviderFactory();
