import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "./anthropic.js";

describe("AnthropicProvider.initialize", () => {
  it("defaults to the real Anthropic API when no baseUrl is given", async () => {
    const provider = new AnthropicProvider();
    await provider.initialize({ apiKey: "test-key" });

    const client = (provider as unknown as { client: Anthropic }).client;
    expect(client.baseURL).toBe("https://api.anthropic.com");
  });

  it("honors a custom baseUrl (needed for Anthropic-API-compatible providers like DeepSeek)", async () => {
    const provider = new AnthropicProvider();
    await provider.initialize({ apiKey: "test-key", baseUrl: "https://api.deepseek.com/anthropic" });

    const client = (provider as unknown as { client: Anthropic }).client;
    expect(client.baseURL).toBe("https://api.deepseek.com/anthropic");
  });
});
