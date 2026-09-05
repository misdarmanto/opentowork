import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Employee } from "../schema/employee.js";
import type { Workflow } from "../schema/workflow.js";
import type { ProviderFactory } from "../providers/factory.js";
import { RunStore } from "../store/index.js";
import { WorkflowExecutor } from "./index.js";

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

/**
 * A fake ProviderFactory that always ends the turn immediately with a fixed
 * artifact. Executor tests are about step sequencing and state transitions,
 * not real LLM behavior — that boundary is exactly what LLMProvider exists
 * to isolate (see CLAUDE.md's provider-agnostic seam).
 */
function fakeProviders(artifact = "output"): ProviderFactory {
  return {
    call: async () => ({
      id: "fake",
      content: [{ type: "text", text: artifact }],
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
    calculateCost: () => 0.01,
  } as unknown as ProviderFactory;
}

describe("WorkflowExecutor", () => {
  let dbPath: string;
  let store: RunStore;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `open-work-executor-test-${Date.now()}-${Math.random()}.sqlite`);
    store = new RunStore(dbPath);
  });

  afterEach(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
    }
  });

  it("runs a linear agent-only workflow to completion", async () => {
    const workflow: Workflow = {
      name: "single-step",
      trigger: "manual",
      steps: [
        {
          name: "research",
          employee: "content-researcher",
          handoff: { objective: "Research {{topic}}", constraints: [] },
        },
      ],
    };

    const executor = new WorkflowExecutor(
      fakeProviders("research brief"),
      store,
      async () => fakeEmployee(),
      { log: () => {} },
    );

    const state = await executor.run(workflow, { topic: "AI agents" });

    expect(state.status).toBe("completed");
    expect(state.stepOutputs.get("research")).toBe("research brief");
    expect(store.getRun(state.runId)?.status).toBe("completed");
  });

  it("passes a prior step's output into the next step's context via depends_on", async () => {
    const workflow: Workflow = {
      name: "two-step",
      trigger: "manual",
      steps: [
        {
          name: "research",
          employee: "content-researcher",
          handoff: { objective: "Research", constraints: [] },
        },
        {
          name: "write-script",
          employee: "content-scriptwriter",
          depends_on: "research",
          handoff: { objective: "Write from research", constraints: [] },
        },
      ],
    };

    const seenContent: string[] = [];
    const providers = {
      call: async (_provider: string, messages: { content: unknown }[]) => {
        seenContent.push(String(messages[messages.length - 1]?.content));
        return {
          id: "fake",
          content: [{ type: "text" as const, text: "script draft" }],
          stopReason: "end_turn" as const,
          usage: { inputTokens: 5, outputTokens: 5 },
        };
      },
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const executor = new WorkflowExecutor(providers, store, async () => fakeEmployee(), {
      log: () => {},
    });

    await executor.run(workflow);

    // The second call's prompt must include both its own objective and the
    // first step's output (the mock returns "script draft" for every call,
    // including the "research" step, so this proves depends_on wiring works
    // rather than the step just echoing its own objective).
    expect(seenContent[1]).toContain("Write from research");
    expect(seenContent[1]).toContain("Previous step output:\nscript draft");
  });

  it("stops at a human approval step and creates a pending approval", async () => {
    const workflow: Workflow = {
      name: "with-approval",
      trigger: "manual",
      steps: [
        {
          name: "research",
          employee: "content-researcher",
          handoff: { objective: "Research", constraints: [] },
        },
        {
          name: "review",
          assignee: "human",
          action: "approve_or_reject",
          depends_on: "research",
        },
      ],
    };

    const executor = new WorkflowExecutor(fakeProviders(), store, async () => fakeEmployee(), {
      log: () => {},
    });

    const state = await executor.run(workflow);

    expect(state.status).toBe("awaiting_approval");
    expect(store.getRun(state.runId)?.status).toBe("awaiting_approval");
    expect(store.listPendingApprovals()).toHaveLength(1);
    expect(store.listPendingApprovals()[0].stepName).toBe("review");
  });

  it("marks the run failed and persists the error when the provider returns a stop reason the executor doesn't handle yet", async () => {
    // Tool-calling isn't wired up yet (see CLAUDE.md / ROADMAP.md Phase 1),
    // so any stop_reason other than "end_turn" is a hard failure by design.
    // This also means the max_turns loop guard is currently unreachable dead
    // code: every iteration either returns (end_turn) or throws (anything
    // else) on its first pass — a real "exceeded max_turns" path only
    // becomes reachable once tool_use has a branch that loops instead of
    // throwing. That gap is intentional scope, not something this test
    // should hide by asserting around it.
    const unhandledStopReasonProvider = {
      call: async () => ({
        id: "fake",
        content: [{ type: "text" as const, text: "thinking..." }],
        stopReason: "max_tokens" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const workflow: Workflow = {
      name: "will-fail",
      trigger: "manual",
      steps: [
        {
          name: "research",
          employee: "content-researcher",
          handoff: { objective: "Research", constraints: [] },
        },
      ],
    };

    const executor = new WorkflowExecutor(
      unhandledStopReasonProvider,
      store,
      async () => fakeEmployee(),
      { log: () => {} },
    );

    await expect(executor.run(workflow)).rejects.toThrow(/Unhandled stop reason "max_tokens"/);

    const runs = store.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("failed");
    expect(runs[0].errorMessage).toMatch(/Unhandled stop reason "max_tokens"/);
  });
});
