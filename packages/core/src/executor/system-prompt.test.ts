import { describe, expect, it } from "vitest";
import type { Employee } from "../schema/employee.js";
import { buildSystemPrompt } from "./system-prompt.js";

function fakeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    name: "content-researcher",
    role: "Researcher",
    skills: [],
    tools: [],
    constraints: { max_turns: 10, max_depth: 3, timeout_seconds: 300 },
    success_criteria: [],
    ...overrides,
  } as Employee;
}

describe("buildSystemPrompt", () => {
  it("always includes name and role", () => {
    const prompt = buildSystemPrompt(fakeEmployee());
    expect(prompt).toContain("You are content-researcher, a Researcher");
  });

  it("includes department when set", () => {
    const prompt = buildSystemPrompt(fakeEmployee({ department: "Content" }));
    expect(prompt).toContain("in the Content department");
  });

  it("omits department phrasing when not set", () => {
    const prompt = buildSystemPrompt(fakeEmployee());
    expect(prompt).not.toContain("department");
  });

  it("includes description, system_prompt, and context when set", () => {
    const prompt = buildSystemPrompt(
      fakeEmployee({
        description: "Finds and verifies sources.",
        system_prompt: "Always be skeptical of single-source claims.",
        context: "The company sells developer tools.",
      }),
    );
    expect(prompt).toContain("Finds and verifies sources.");
    expect(prompt).toContain("Always be skeptical of single-source claims.");
    expect(prompt).toContain("Reference context:\nThe company sells developer tools.");
  });

  it("includes success_criteria as a bulleted list", () => {
    const prompt = buildSystemPrompt(
      fakeEmployee({ success_criteria: ["cites 5 sources", "no hallucinated URLs"] }),
    );
    expect(prompt).toContain("- cites 5 sources");
    expect(prompt).toContain("- no hallucinated URLs");
  });

  it("appends extraInstructions (used by resolved skills)", () => {
    const prompt = buildSystemPrompt(fakeEmployee(), ["When researching, always cite dates."]);
    expect(prompt).toContain("When researching, always cite dates.");
  });

  it("produces a minimal prompt for a bare-minimum employee (no optional fields)", () => {
    const prompt = buildSystemPrompt(fakeEmployee());
    expect(prompt).toBe("You are content-researcher, a Researcher.");
  });
});
