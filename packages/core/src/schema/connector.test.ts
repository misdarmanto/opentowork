import { describe, expect, it } from "vitest";
import { parseConnector } from "./connector.js";

describe("parseConnector", () => {
  it("accepts a valid mcp connector", () => {
    const connector = parseConnector({
      type: "mcp",
      name: "duckduckgo",
      command: "npx",
      args: ["-y", "duckduckgo-mcp-server"],
    });
    expect(connector).toMatchObject({ type: "mcp", name: "duckduckgo" });
  });

  it("accepts a valid custom connector", () => {
    const connector = parseConnector({ type: "custom", name: "verify-source", path: "./tools/verify.js" });
    expect(connector).toMatchObject({ type: "custom", name: "verify-source" });
  });

  it("rejects a builtin type (connectors are only mcp or custom)", () => {
    expect(() => parseConnector({ type: "builtin", name: "kb" })).toThrow();
  });

  it("rejects a connector type (a connector can't reference another connector)", () => {
    expect(() => parseConnector({ type: "connector", connector: "other" })).toThrow();
  });
});
