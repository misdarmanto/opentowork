import { describe, expect, it } from "vitest";
import { parseEmployee } from "./employee.js";

const validEmployee = {
  name: "content-researcher",
  role: "Researcher",
  provider: "anthropic",
  model: "claude-sonnet-4",
};

describe("parseEmployee", () => {
  it("accepts a minimal valid employee and fills in constraint defaults", () => {
    const parsed = parseEmployee(validEmployee);
    expect(parsed.constraints).toEqual({
      max_turns: 10,
      max_depth: 3,
      timeout_seconds: 300,
    });
    expect(parsed.skills).toEqual([]);
    expect(parsed.tools).toEqual([]);
  });

  it("rejects an unknown provider", () => {
    expect(() => parseEmployee({ ...validEmployee, provider: "chatgpt" })).toThrow();
  });

  it("rejects a missing required field", () => {
    const { model: _model, ...withoutModel } = validEmployee;
    expect(() => parseEmployee(withoutModel)).toThrow();
  });

  it("accepts an mcp tool with credentials_from", () => {
    const parsed = parseEmployee({
      ...validEmployee,
      tools: [{ type: "mcp", name: "brave-search", credentials_from: "${BRAVE_API_KEY}" }],
    });
    expect(parsed.tools).toHaveLength(1);
    expect(parsed.tools[0]).toMatchObject({ type: "mcp", name: "brave-search" });
  });

  it("rejects a tool with an unknown type", () => {
    expect(() =>
      parseEmployee({ ...validEmployee, tools: [{ type: "slack-webhook", name: "x" }] }),
    ).toThrow();
  });

  it("rejects a custom tool missing its required path", () => {
    expect(() =>
      parseEmployee({ ...validEmployee, tools: [{ type: "custom", name: "verify" }] }),
    ).toThrow();
  });
});
