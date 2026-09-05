import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunStore } from "./index.js";

describe("RunStore", () => {
  let dbPath: string;
  let store: RunStore;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `open-work-test-${Date.now()}-${Math.random()}.sqlite`);
    store = new RunStore(dbPath);
  });

  afterEach(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
    }
  });

  it("creates tables on first open (no migration step required)", () => {
    expect(store.listRuns()).toEqual([]);
  });

  it("records a run and can read it back", () => {
    store.createRun({ id: "run-1", workflowName: "research-and-script" });
    const run = store.getRun("run-1");
    expect(run?.status).toBe("running");
    expect(run?.workflowName).toBe("research-and-script");
    expect(run?.orgId).toBe("default");
  });

  it("updates run status and records completion time", () => {
    store.createRun({ id: "run-1", workflowName: "research-and-script" });
    const completedAt = new Date();
    store.updateRunStatus("run-1", "completed", { completedAt });
    const run = store.getRun("run-1");
    expect(run?.status).toBe("completed");
    expect(run?.completedAt?.getTime()).toBe(Math.floor(completedAt.getTime() / 1000) * 1000);
  });

  it("records steps against a run", () => {
    store.createRun({ id: "run-1", workflowName: "research-and-script" });
    store.recordStep({
      id: "step-1",
      runId: "run-1",
      stepName: "research",
      status: "completed",
      inputTokens: 100,
      outputTokens: 200,
      cost: 0.01,
      output: "brief.md",
    });
    const steps = store.listSteps("run-1");
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      id: "step-1",
      stepName: "research",
      status: "completed",
      inputTokens: 100,
      outputTokens: 200,
      cost: 0.01,
      output: "brief.md",
    });
  });

  it("tracks an approval from pending to approved", () => {
    store.createRun({ id: "run-1", workflowName: "research-and-script" });
    store.createApproval({ id: "approval-1", runId: "run-1", stepName: "review" });

    expect(store.listPendingApprovals()).toHaveLength(1);

    store.decideApproval("approval-1", "approved", "reviewer@example.com");
    expect(store.listPendingApprovals()).toHaveLength(0);
  });

  it("tracks an approval from pending to rejected", () => {
    // The rejected path is what Phase 1's resubmit-to-step gate depends on —
    // worth its own case, not just lumped in with "approved".
    store.createRun({ id: "run-1", workflowName: "research-and-script" });
    store.createApproval({ id: "approval-1", runId: "run-1", stepName: "review" });

    store.decideApproval("approval-1", "rejected", "reviewer@example.com");

    expect(store.listPendingApprovals()).toHaveLength(0);
  });

  it("isolates runs by org_id", () => {
    store.createRun({ id: "run-1", workflowName: "wf", orgId: "org-a" });
    store.createRun({ id: "run-2", workflowName: "wf", orgId: "org-b" });

    expect(store.listRuns("org-a")).toHaveLength(1);
    expect(store.listRuns("org-b")).toHaveLength(1);
    expect(store.listRuns("org-a")[0].id).toBe("run-1");
  });
});
