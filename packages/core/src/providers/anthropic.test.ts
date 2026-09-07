import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
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

/**
 * Mocks the SDK client's messages.create — these tests are about
 * AnthropicProvider's own translation logic (stop-reason mapping, usage
 * pass-through), not about whether the Anthropic API itself works.
 */
async function providerWithMockedCreate(response: Partial<Anthropic.Message>) {
  const provider = new AnthropicProvider();
  await provider.initialize({ apiKey: "test-key" });
  const client = (provider as unknown as { client: Anthropic }).client;
  const create = vi.fn().mockResolvedValue(response);
  client.messages.create = create as unknown as typeof client.messages.create;
  return { provider, create };
}

describe("AnthropicProvider.call", () => {
  const baseResponse = {
    id: "msg_1",
    content: [{ type: "text" as const, text: "hello", citations: null }],
    usage: { input_tokens: 10, output_tokens: 5 },
  };

  it("maps stop_reason 'tool_use' to the unified 'tool_use'", async () => {
    const { provider } = await providerWithMockedCreate({ ...baseResponse, stop_reason: "tool_use" });
    const result = await provider.call([{ role: "user", content: "hi" }], { model: "claude-sonnet-4" });
    expect(result.stopReason).toBe("tool_use");
  });

  it("maps stop_reason 'max_tokens' to the unified 'max_tokens'", async () => {
    const { provider } = await providerWithMockedCreate({ ...baseResponse, stop_reason: "max_tokens" });
    const result = await provider.call([{ role: "user", content: "hi" }], { model: "claude-sonnet-4" });
    expect(result.stopReason).toBe("max_tokens");
  });

  it("maps every other stop_reason (e.g. 'end_turn', 'stop_sequence', null) to the unified 'end_turn'", async () => {
    const rawReasons = ["end_turn", "stop_sequence", null] as const;
    for (const raw of rawReasons) {
      const { provider } = await providerWithMockedCreate({ ...baseResponse, stop_reason: raw });
      const result = await provider.call([{ role: "user", content: "hi" }], { model: "claude-sonnet-4" });
      expect(result.stopReason).toBe("end_turn");
    }
  });

  it("passes usage tokens through unchanged", async () => {
    const { provider } = await providerWithMockedCreate({ ...baseResponse, stop_reason: "end_turn" });
    const result = await provider.call([{ role: "user", content: "hi" }], { model: "claude-sonnet-4" });
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("forwards model config and tool schemas to the SDK call", async () => {
    const { provider, create } = await providerWithMockedCreate({ ...baseResponse, stop_reason: "end_turn" });
    await provider.call(
      [{ role: "user", content: "hi" }],
      { model: "claude-sonnet-4", temperature: 0.4, maxTokens: 111 },
      [{ name: "echo", description: "echoes", inputSchema: { type: "object" } }],
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4",
        temperature: 0.4,
        max_tokens: 111,
        tools: [{ name: "echo", description: "echoes", input_schema: { type: "object" } }],
      }),
    );
  });

  it("forwards the system prompt to the SDK call", async () => {
    const { provider, create } = await providerWithMockedCreate({ ...baseResponse, stop_reason: "end_turn" });
    await provider.call(
      [{ role: "user", content: "hi" }],
      { model: "claude-sonnet-4" },
      undefined,
      "You are a helpful researcher.",
    );

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ system: "You are a helpful researcher." }));
  });

  it("omits the system field (undefined) when no employee system prompt is built", async () => {
    const { provider, create } = await providerWithMockedCreate({ ...baseResponse, stop_reason: "end_turn" });
    await provider.call([{ role: "user", content: "hi" }], { model: "claude-sonnet-4" });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ system: undefined }));
  });
});

describe("AnthropicProvider.calculateCost", () => {
  const provider = new AnthropicProvider();

  it("computes cost from the per-1k pricing table for a known model", () => {
    // claude-sonnet-4: $0.003/1k input, $0.015/1k output
    const cost = provider.calculateCost(2000, 1000, "claude-sonnet-4");
    expect(cost).toBeCloseTo(2 * 0.003 + 1 * 0.015, 10);
  });

  it("returns 0 for an unrecognized model rather than guessing a price", () => {
    expect(provider.calculateCost(1000, 1000, "deepseek-v4-flash")).toBe(0);
  });
});

describe("AnthropicProvider.getModelInfo", () => {
  const provider = new AnthropicProvider();

  it("returns pricing and context window for a known model", () => {
    const info = provider.getModelInfo("claude-3-5-haiku");
    expect(info).toMatchObject({
      name: "claude-3-5-haiku",
      contextWindow: 200_000,
      supportsTools: true,
      inputCostPer1kTokens: 0.0008,
      outputCostPer1kTokens: 0.004,
    });
  });

  it("returns zeroed pricing for an unrecognized model, not a fabricated guess", () => {
    const info = provider.getModelInfo("some-future-model");
    expect(info.inputCostPer1kTokens).toBe(0);
    expect(info.outputCostPer1kTokens).toBe(0);
  });
});
