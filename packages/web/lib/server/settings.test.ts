import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addCustomModel, clearApiKey, getSettingsView, removeCustomModel, setApiKey } from "./settings";
import { STATE_DIR } from "./paths";

const settingsFilePath = path.join(STATE_DIR, "settings.json");

describe("settings view (never round-trips a real key value)", () => {
  afterEach(() => {
    if (fs.existsSync(settingsFilePath)) fs.rmSync(settingsFilePath);
  });

  it("reports a provider as unconfigured when nothing is set", () => {
    const view = getSettingsView();
    const anthropic = view.providers.find((p) => p.provider === "anthropic");
    expect(anthropic).toMatchObject({ configured: false, source: "none" });
    expect(anthropic?.last4).toBeUndefined();
  });

  it("setApiKey stores the key and getSettingsView only ever exposes its last 4 characters", () => {
    setApiKey("anthropic", "sk-ant-real-secret-value-1234");

    const view = getSettingsView();
    const anthropic = view.providers.find((p) => p.provider === "anthropic");
    expect(anthropic).toMatchObject({ configured: true, source: "settings", last4: "1234" });

    // The real value is never present anywhere in the response.
    expect(JSON.stringify(view)).not.toContain("sk-ant-real-secret-value");
  });

  it("clearApiKey removes a UI-set key, falling back to unconfigured (no env var set in this test)", () => {
    setApiKey("anthropic", "sk-ant-real-secret-value-1234");
    clearApiKey("anthropic");

    const anthropic = getSettingsView().providers.find((p) => p.provider === "anthropic");
    expect(anthropic).toMatchObject({ configured: false, source: "none" });
  });

  it("addCustomModel/removeCustomModel round-trip through getSettingsView", () => {
    addCustomModel("deepseek", "deepseek-v4-flash");
    expect(getSettingsView().customModels).toEqual([{ provider: "deepseek", name: "deepseek-v4-flash" }]);

    removeCustomModel("deepseek", "deepseek-v4-flash");
    expect(getSettingsView().customModels).toEqual([]);
  });

  it("addCustomModel does not add the same provider+name pair twice", () => {
    addCustomModel("deepseek", "deepseek-v4-flash");
    addCustomModel("deepseek", "deepseek-v4-flash");
    expect(getSettingsView().customModels).toHaveLength(1);
  });
});
