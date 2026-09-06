import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadMcpTools } from "./mcp.js";
import type { LoadedTool } from "./types.js";

const fixtureServer = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "echo-mcp-server.mjs");

describe("loadMcpTools", () => {
  let loaded: LoadedTool[] = [];

  afterEach(async () => {
    for (const tool of loaded) await tool.close?.();
    loaded = [];
  });

  it("connects to a real MCP server over stdio, lists its tools, and calls one", async () => {
    loaded = await loadMcpTools({
      type: "mcp",
      name: "echo-test",
      command: "node",
      args: [fixtureServer],
    });

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("echo");
    expect(loaded[0].description).toContain("Echoes");

    const result = await loaded[0].execute({ text: "hello" });
    expect(result).toBe("olleh");
  }, 15_000);

  it("rejects when no command is configured", async () => {
    await expect(loadMcpTools({ type: "mcp", name: "no-command", args: [] })).rejects.toThrow(/no "command"/);
  });
});
