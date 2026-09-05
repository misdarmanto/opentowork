import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadCustomTool } from "./custom.js";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url)) + "/__fixtures__";

describe("loadCustomTool", () => {
  it("dynamically imports the module and wraps its defineCustomTool() export", async () => {
    const tool = await loadCustomTool(
      { type: "custom", name: "echo", path: "echo-custom-tool.mjs" },
      fixturesDir,
    );

    expect(tool.name).toBe("echo");
    expect(tool.inputSchema).toMatchObject({ type: "object" });

    const result = await tool.execute({ text: "hello" });
    expect(result).toBe(JSON.stringify({ echoed: "HELLO" }));
  });

  it("rejects a module that doesn't export defineCustomTool", async () => {
    await expect(
      loadCustomTool({ type: "custom", name: "bad", path: "not-a-real-file.mjs" }, fixturesDir),
    ).rejects.toThrow();
  });

  it("times out a tool that never resolves", async () => {
    const tool = await loadCustomTool(
      { type: "custom", name: "slow", path: "slow-custom-tool.mjs", timeout: 0.05 },
      fixturesDir,
    );

    await expect(tool.execute({})).rejects.toThrow(/timed out after 50ms/);
  });
});
