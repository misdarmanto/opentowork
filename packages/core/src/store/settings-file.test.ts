import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSettingsFile, writeSettingsFile } from "./settings-file.js";
import { emptySettings } from "../schema/settings.js";

describe("settings file store", () => {
  let stateDir: string;

  afterEach(() => {
    if (stateDir) fs.rmSync(stateDir, { recursive: true, force: true });
  });

  it("returns empty settings when no file exists yet", () => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-settings-"));
    expect(readSettingsFile(stateDir)).toEqual(emptySettings());
  });

  it("round-trips a real write through a real read", () => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-settings-"));
    const settings = {
      apiKeys: { anthropic: "sk-ant-real-value" },
      customModels: [{ provider: "anthropic" as const, name: "claude-opus-5" }],
    };

    writeSettingsFile(stateDir, settings);

    expect(readSettingsFile(stateDir)).toEqual(settings);
  });

  it("falls back to empty settings instead of throwing on a corrupt file", () => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-settings-"));
    fs.writeFileSync(path.join(stateDir, "settings.json"), "{ not valid json");

    expect(readSettingsFile(stateDir)).toEqual(emptySettings());
  });
});
