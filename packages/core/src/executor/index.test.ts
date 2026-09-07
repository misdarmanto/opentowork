import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Employee } from "../schema/employee.js";
import { isHumanStep, type Workflow } from "../schema/workflow.js";
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

  it("builds and forwards a real system prompt from the employee's persona fields", async () => {
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

    let seenSystem: string | undefined;
    const providers = {
      call: async (
        _provider: string,
        _messages: unknown,
        _modelConfig: unknown,
        _tools: unknown,
        system?: string,
      ) => {
        seenSystem = system;
        return {
          id: "fake",
          content: [{ type: "text" as const, text: "brief" }],
          stopReason: "end_turn" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const executor = new WorkflowExecutor(
      providers,
      store,
      async () =>
        fakeEmployee({
          department: "Content",
          system_prompt: "Always cite your sources.",
          success_criteria: ["cites 5 sources"],
        }),
      { log: () => {} },
    );

    await executor.run(workflow);

    expect(seenSystem).toContain("You are content-researcher, a Researcher in the Content department.");
    expect(seenSystem).toContain("Always cite your sources.");
    expect(seenSystem).toContain("- cites 5 sources");
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

  it("executes a tool_use round trip against a real custom tool before finishing", async () => {
    const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tools", "__fixtures__");

    const workflow: Workflow = {
      name: "with-tool",
      trigger: "manual",
      steps: [
        {
          name: "research",
          employee: "content-researcher",
          handoff: { objective: "Echo something", constraints: [] },
        },
      ],
    };

    let call = 0;
    const toolCallingProvider = {
      call: async () => {
        call++;
        if (call === 1) {
          // First turn: the model decides to call the "echo" tool.
          return {
            id: "fake-1",
            content: [{ type: "tool_use" as const, id: "tool-1", name: "echo", input: { text: "hi" } }],
            stopReason: "tool_use" as const,
            usage: { inputTokens: 5, outputTokens: 5 },
          };
        }
        // Second turn: the model has the tool_result and finishes.
        return {
          id: "fake-2",
          content: [{ type: "text" as const, text: "done" }],
          stopReason: "end_turn" as const,
          usage: { inputTokens: 5, outputTokens: 5 },
        };
      },
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const executor = new WorkflowExecutor(
      toolCallingProvider,
      store,
      async () =>
        fakeEmployee({
          tools: [{ type: "custom", name: "echo", path: "echo-custom-tool.mjs" }],
        }),
      { log: () => {} },
      fixturesDir,
    );

    const state = await executor.run(workflow);

    expect(call).toBe(2); // proves the loop actually went through a tool round trip, not just one call
    expect(state.status).toBe("completed");
    expect(state.stepOutputs.get("research")).toBe("done");
  });

  it("resolves a {type: connector} tool reference end-to-end via the executor's loadConnector param", async () => {
    const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tools", "__fixtures__");

    const workflow: Workflow = {
      name: "with-connector",
      trigger: "manual",
      steps: [
        {
          name: "research",
          employee: "content-researcher",
          handoff: { objective: "Echo something", constraints: [] },
        },
      ],
    };

    let call = 0;
    let connectorLookups = 0;
    const toolCallingProvider = {
      call: async () => {
        call++;
        if (call === 1) {
          return {
            id: "fake-1",
            content: [{ type: "tool_use" as const, id: "tool-1", name: "echo", input: { text: "hi" } }],
            stopReason: "tool_use" as const,
            usage: { inputTokens: 5, outputTokens: 5 },
          };
        }
        return {
          id: "fake-2",
          content: [{ type: "text" as const, text: "done via connector" }],
          stopReason: "end_turn" as const,
          usage: { inputTokens: 5, outputTokens: 5 },
        };
      },
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const executor = new WorkflowExecutor(
      toolCallingProvider,
      store,
      async () => fakeEmployee({ tools: [{ type: "connector", connector: "shared-echo" }] }),
      { log: () => {} },
      fixturesDir,
      async (name) => {
        connectorLookups++;
        expect(name).toBe("shared-echo");
        return { type: "custom", name: "echo", path: "echo-custom-tool.mjs" };
      },
    );

    const state = await executor.run(workflow);

    expect(connectorLookups).toBe(1);
    expect(state.status).toBe("completed");
    expect(state.stepOutputs.get("research")).toBe("done via connector");
  });
});

describe("WorkflowExecutor.approve / reject / resume", () => {
  let dbPath: string;
  let store: RunStore;

  const workflowWithReview: Workflow = {
    name: "with-review",
    trigger: "manual",
    steps: [
      {
        name: "write-script",
        employee: "content-scriptwriter",
        handoff: { objective: "Write a script", constraints: [] },
      },
      {
        name: "review",
        assignee: "human",
        action: "approve_or_reject",
        depends_on: "write-script",
        on_reject: { resubmit_to: "write-script", max_attempts: 2 },
      },
      {
        name: "notify",
        employee: "content-scriptwriter",
        depends_on: "review",
        handoff: { objective: "Say the script was sent", constraints: [] },
      },
    ],
  };

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `open-work-approval-test-${Date.now()}-${Math.random()}.sqlite`);
    store = new RunStore(dbPath);
  });

  afterEach(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
    }
  });

  it("stops at the human step, then approve() continues to the following step", async () => {
    let scriptCalls = 0;
    const providers = {
      call: async () => {
        scriptCalls++;
        return {
          id: "fake",
          content: [{ type: "text" as const, text: `draft ${scriptCalls}` }],
          stopReason: "end_turn" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const executor = new WorkflowExecutor(providers, store, async () => fakeEmployee(), { log: () => {} });

    const afterRun = await executor.run(workflowWithReview);
    expect(afterRun.status).toBe("awaiting_approval");
    expect(scriptCalls).toBe(1); // only write-script ran; notify has not

    const afterApprove = await executor.approve(afterRun.runId, workflowWithReview);
    expect(afterApprove.status).toBe("completed");
    expect(scriptCalls).toBe(2); // notify (also content-scriptwriter) ran too
    expect(store.getRun(afterRun.runId)?.status).toBe("completed");
  });

  it("reject() with attempts remaining re-executes resubmit_to, then awaits approval again", async () => {
    let scriptCalls = 0;
    const providers = {
      call: async () => {
        scriptCalls++;
        return {
          id: "fake",
          content: [{ type: "text" as const, text: `draft ${scriptCalls}` }],
          stopReason: "end_turn" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const executor = new WorkflowExecutor(providers, store, async () => fakeEmployee(), { log: () => {} });

    const afterRun = await executor.run(workflowWithReview);
    expect(store.getLatestStepsByName(afterRun.runId).get("write-script")?.output).toBe("draft 1");

    const afterReject = await executor.reject(afterRun.runId, workflowWithReview);
    // Rejected with 1 attempt used, max_attempts is 2 -> resubmits to
    // write-script, which re-runs (proving it isn't just replayed from
    // the old stored output) and lands back on awaiting_approval.
    expect(scriptCalls).toBe(2);
    expect(afterReject.status).toBe("awaiting_approval");
    expect(afterReject.stepOutputs.get("write-script")).toBe("draft 2");
    expect(store.getLatestStepsByName(afterRun.runId).get("write-script")?.output).toBe("draft 2");

    const afterApprove = await executor.approve(afterRun.runId, workflowWithReview);
    expect(afterApprove.status).toBe("completed");
    expect(scriptCalls).toBe(3);
  });

  it("marks the rejected step 'superseded' durably before re-running it, so a crash mid-retry can't leave the old (rejected) output looking done", async () => {
    let scriptCalls = 0;
    const crashesOnRetry = {
      call: async () => {
        scriptCalls++;
        if (scriptCalls === 2) {
          // Simulates the process dying partway through the resubmitted
          // step's execution — after reject() has already committed the
          // decision and the supersede, before write-script's re-run ever
          // records a new "completed" row.
          throw new Error("simulated crash mid-retry");
        }
        return {
          id: "fake",
          content: [{ type: "text" as const, text: `draft ${scriptCalls}` }],
          stopReason: "end_turn" as const,
          usage: { inputTokens: 1, outputTokens: 1 },
        };
      },
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const executor = new WorkflowExecutor(crashesOnRetry, store, async () => fakeEmployee(), { log: () => {} });

    const afterRun = await executor.run(workflowWithReview);
    expect(store.getLatestStepsByName(afterRun.runId).get("write-script")?.status).toBe("completed");

    await expect(executor.reject(afterRun.runId, workflowWithReview)).rejects.toThrow("simulated crash mid-retry");

    // The critical property: the OLD write-script row must not still read
    // as "completed" after the crash. If it did, a later resume() would
    // treat the rejected draft as done and skip re-running it entirely.
    const writeScriptRow = store.getLatestStepsByName(afterRun.runId).get("write-script");
    expect(writeScriptRow?.status).toBe("superseded");
    expect(writeScriptRow?.output).toBe("draft 1"); // the rejected draft, now clearly marked stale
  });

  it("reject() fails the run once max_attempts is exceeded", async () => {
    const workflowNoRetries: Workflow = {
      ...workflowWithReview,
      steps: workflowWithReview.steps.map((s) =>
        s.name === "review" && isHumanStep(s) ? { ...s, on_reject: { resubmit_to: "write-script", max_attempts: 0 } } : s,
      ),
    };

    const providers = {
      call: async () => ({
        id: "fake",
        content: [{ type: "text" as const, text: "draft" }],
        stopReason: "end_turn" as const,
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
      calculateCost: () => 0,
    } as unknown as ProviderFactory;

    const executor = new WorkflowExecutor(providers, store, async () => fakeEmployee(), { log: () => {} });

    const afterRun = await executor.run(workflowNoRetries);
    const afterReject = await executor.reject(afterRun.runId, workflowNoRetries);

    expect(afterReject.status).toBe("failed");
    expect(store.getRun(afterRun.runId)?.status).toBe("failed");
    expect(store.getRun(afterRun.runId)?.errorMessage).toMatch(/rejected and max attempts exceeded/);
  });

  it("resume() on a run still awaiting a decision reports awaiting_approval without duplicating the approval", async () => {
    const providers = fakeProviders("draft");
    const executor = new WorkflowExecutor(providers, store, async () => fakeEmployee(), { log: () => {} });

    const afterRun = await executor.run(workflowWithReview);
    expect(store.listPendingApprovals()).toHaveLength(1);

    // Simulate restarting the CLI process: a fresh resume() call with no
    // in-memory state, before any approve/reject decision was made.
    const resumed = await executor.resume(afterRun.runId, workflowWithReview);

    expect(resumed.status).toBe("awaiting_approval");
    expect(store.listPendingApprovals()).toHaveLength(1); // not duplicated
  });

  it("resume() on an already-completed run is a no-op that returns the completed state", async () => {
    const providers = fakeProviders("draft");
    const executor = new WorkflowExecutor(providers, store, async () => fakeEmployee(), { log: () => {} });

    const singleStepWorkflow: Workflow = {
      name: "single",
      trigger: "manual",
      steps: [{ name: "only", employee: "x", handoff: { objective: "go", constraints: [] } }],
    };

    const afterRun = await executor.run(singleStepWorkflow);
    expect(afterRun.status).toBe("completed");

    const resumed = await executor.resume(afterRun.runId, singleStepWorkflow);
    expect(resumed.status).toBe("completed");
  });
});
