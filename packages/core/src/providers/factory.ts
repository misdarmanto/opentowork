import type { LLMProvider, LLMResponse, MessageParam, ModelConfig, ProviderConfig, ToolSchema } from "./types.js";
import { createLogger } from "../logger.js";

const logger = createLogger("provider:factory");

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
      try {
        await provider.initialize(this.configs.get(name)!);
        this.initialized.add(name);
      } catch (err) {
        logger.error("provider initialization failed", { provider: name, err });
        throw err;
      }
    }
    return provider;
  }

  async call(
    providerName: string,
    messages: MessageParam[],
    modelConfig: ModelConfig,
    tools?: ToolSchema[],
    system?: string,
  ): Promise<LLMResponse> {
    const provider = await this.get(providerName);
    try {
      return await provider.call(messages, modelConfig, tools, system);
    } catch (err) {
      logger.error("provider call failed", { provider: providerName, model: modelConfig.model, err });
      throw err;
    }
  }

  calculateCost(providerName: string, inputTokens: number, outputTokens: number, model: string): number {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Provider "${providerName}" not registered`);
    return provider.calculateCost(inputTokens, outputTokens, model);
  }
}

export const providerFactory = new ProviderFactory();
