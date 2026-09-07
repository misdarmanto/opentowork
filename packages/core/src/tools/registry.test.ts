import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Employee } from "../schema/employee.js";
import type { Connector } from "../schema/connector.js";
import { loadToolsForEmployee } from "./registry.js";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__");

function fakeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    name: "content-researcher",
    role: "Researcher",
    provider: "anthropic",
    model: "claude-sonnet-4",
    skills: [],
    tools: [],
    constraints: { max_turns: 10, max_depth: 3, timeout_seconds: 300 },
    success_criteria: [],
    ...overrides,
  };
}

describe("loadToolsForEmployee — connector references", () => {
  it("resolves a {type: connector} tool via the injected loader to a real, callable tool", async () => {
    const connector: Connector = { type: "custom", name: "echo", path: "echo-custom-tool.mjs" };
    const tools = await loadToolsForEmployee(
      fakeEmployee({ tools: [{ type: "connector", connector: "shared-echo" }] }),
      fixturesDir,
      async (name) => {
        expect(name).toBe("shared-echo"); // proves the connector name round-trips correctly
        return connector;
      },
    );

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("echo");
    const result = await tools[0].execute({ text: "hi" });
    expect(result).toBe(JSON.stringify({ echoed: "HI" }));
  });

  it("throws a clear error for a connector reference when no loader was configured", async () => {
    await expect(
      loadToolsForEmployee(fakeEmployee({ tools: [{ type: "connector", connector: "x" }] }), fixturesDir),
    ).rejects.toThrow(/no connector loader was configured/);
  });

  it("still throws for builtin tools (unchanged behavior)", async () => {
    await expect(
      loadToolsForEmployee(fakeEmployee({ tools: [{ type: "builtin", name: "kb" }] }), fixturesDir),
    ).rejects.toThrow(/not implemented yet/);
  });
});
