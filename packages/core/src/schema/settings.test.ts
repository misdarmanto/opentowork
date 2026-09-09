import { describe, expect, it } from "vitest";
import { emptySettings, parseSettings } from "./settings.js";

describe("parseSettings", () => {
  it("defaults to empty apiKeys/customModels when given an empty object", () => {
    expect(parseSettings({})).toEqual(emptySettings());
  });

  it("accepts api keys for any declared provider, including ones with no implementation yet", () => {
    const settings = parseSettings({ apiKeys: { anthropic: "sk-1", openai: "sk-2" } });
    expect(settings.apiKeys).toEqual({ anthropic: "sk-1", openai: "sk-2" });
  });

  it("accepts a list of custom models", () => {
    const settings = parseSettings({
      customModels: [{ provider: "deepseek", name: "deepseek-v4-flash" }],
    });
    expect(settings.customModels).toEqual([{ provider: "deepseek", name: "deepseek-v4-flash" }]);
  });

  it("rejects an unknown provider", () => {
    expect(() => parseSettings({ apiKeys: { made_up: "x" } })).toThrow();
  });
});
