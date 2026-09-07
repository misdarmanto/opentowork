import { describe, expect, it } from "vitest";
import { parseSkill } from "./skill.js";

describe("parseSkill", () => {
  it("accepts a minimal skill with only instructions", () => {
    const skill = parseSkill({ name: "web-research", instructions: "Prefer primary sources." });
    expect(skill).toMatchObject({ name: "web-research", instructions: "Prefer primary sources.", tools: [] });
  });

  it("accepts a skill that also contributes tools", () => {
    const skill = parseSkill({
      name: "web-research",
      instructions: "Prefer primary sources.",
      tools: [{ type: "connector", connector: "duckduckgo" }],
    });
    expect(skill.tools).toEqual([{ type: "connector", connector: "duckduckgo" }]);
  });

  it("rejects a skill with no instructions", () => {
    expect(() => parseSkill({ name: "web-research" })).toThrow();
  });
});
