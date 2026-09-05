import { describe, expect, it } from "vitest";
import { isHumanStep, parseWorkflow } from "./workflow.js";

const validWorkflow = {
  name: "research-and-script",
  steps: [
    {
      name: "research",
      employee: "content-researcher",
      handoff: { objective: "Research {{topic}}" },
    },
    {
      name: "review",
      assignee: "human",
      action: "approve_or_reject",
      depends_on: "research",
      on_reject: { resubmit_to: "research", max_attempts: 2 },
    },
  ],
};

describe("parseWorkflow", () => {
  it("parses a valid workflow with an agent step and a human step", () => {
    const parsed = parseWorkflow(validWorkflow);
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.trigger).toBe("manual");
  });

  it("rejects a workflow with zero steps", () => {
    expect(() => parseWorkflow({ ...validWorkflow, steps: [] })).toThrow();
  });

  it("rejects a human step with an invalid action", () => {
    const broken = {
      ...validWorkflow,
      steps: [{ name: "review", assignee: "human", action: "just_do_it" }],
    };
    expect(() => parseWorkflow(broken)).toThrow();
  });

  it("rejects an agent step missing its handoff", () => {
    const broken = {
      ...validWorkflow,
      steps: [{ name: "research", employee: "content-researcher" }],
    };
    expect(() => parseWorkflow(broken)).toThrow();
  });
});

describe("isHumanStep", () => {
  it("distinguishes human steps from agent steps", () => {
    const parsed = parseWorkflow(validWorkflow);
    expect(isHumanStep(parsed.steps[0])).toBe(false);
    expect(isHumanStep(parsed.steps[1])).toBe(true);
  });
});
