import { describe, expect, it } from "vitest";
import { loadMcpTools } from "./mcp.js";

/**
 * Tests against the REAL third-party MCP servers used in config/employees/
 * (not our own test fixtures) — proves the actual packages we depend on are
 * still reachable and speak the protocol we expect, which
 * `tools/mcp.test.ts`'s fixture server can't prove on its own.
 *
 * Deliberately does NOT assert on search results. DuckDuckGo's HTML search
 * anomaly-blocks scraping from many IPs (datacenter/CI ranges especially —
 * see ROADMAP.md Phase 2) and can rate-limit even on a real residential
 * connection, so asserting on result content would make this test flaky for
 * reasons that have nothing to do with our code. Connecting and listing
 * tools only depends on the npm package and stdio transport, which is
 * within our control.
 *
 * Skipped in CI: `npx -y duckduckgo-mcp-server` on a cold GitHub Actions
 * runner means a live npm-registry fetch inside this test's timeout, which
 * would make every PR depend on registry availability/speed for a check
 * that only re-verifies a third-party package's protocol, not our code. Run
 * it locally (`pnpm --filter @open-work/core exec vitest run
 * src/tools/integrations.test.ts`) after bumping `duckduckgo-mcp-server` or
 * when in doubt that it's still compatible.
 */
describe.skipIf(process.env.CI)("duckduckgo-mcp-server (real third-party package)", () => {
  it("connects over stdio and advertises duckduckgo_web_search with the expected input schema", async () => {
    const tools = await loadMcpTools({
      type: "mcp",
      name: "duckduckgo",
      command: "npx",
      args: ["-y", "duckduckgo-mcp-server"],
    });

    try {
      const search = tools.find((t) => t.name === "duckduckgo_web_search");
      expect(search).toBeDefined();
      expect(search?.inputSchema).toMatchObject({
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      });
    } finally {
      for (const t of tools) await t.close?.();
    }
  }, 30_000);
});
