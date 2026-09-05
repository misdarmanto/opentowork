import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunStore } from "../store/index.js";
import { combineTracers, createFileTracer, writeArtifacts, writeStateSnapshot } from "./tracer.js";

describe("createFileTracer", () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-tracer-"));
  });

  afterEach(() => {
    fs.rmSync(runsDir, { recursive: true, force: true });
  });

  it("appends one JSON line per log call to trace.jsonl", () => {
    const tracer = createFileTracer(runsDir, "run-1");
    tracer.log({ event: "step_started", step: "research" });
    tracer.log({ event: "step_completed", step: "research" });

    const tracePath = path.join(runsDir, "run-1", "trace.jsonl");
    const lines = fs.readFileSync(tracePath, "utf-8").trim().split("\n");

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ event: "step_started", step: "research" });
    expect(JSON.parse(lines[0])).toHaveProperty("timestamp");
    expect(JSON.parse(lines[1])).toMatchObject({ event: "step_completed" });
  });
});

describe("combineTracers", () => {
  it("forwards each log call to every underlying tracer", () => {
    const a: Record<string, unknown>[] = [];
    const b: Record<string, unknown>[] = [];
    const tracer = combineTracers({ log: (e) => a.push(e) }, { log: (e) => b.push(e) });

    tracer.log({ event: "x" });

    expect(a).toEqual([{ event: "x" }]);
    expect(b).toEqual([{ event: "x" }]);
  });
});

describe("writeStateSnapshot", () => {
  let runsDir: string;
  let dbPath: string;
  let store: RunStore;

  beforeEach(() => {
    runsDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-state-"));
    dbPath = path.join(os.tmpdir(), `open-work-state-db-${Date.now()}.sqlite`);
    store = new RunStore(dbPath);
  });

  afterEach(() => {
    fs.rmSync(runsDir, { recursive: true, force: true });
    for (const suffix of ["", "-wal", "-shm"]) {
      if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
    }
  });

  it("writes a state.json reflecting what's actually in RunStore, not stale data", () => {
    store.createRun({ id: "run-1", workflowName: "wf" });
    store.recordStep({ id: "step-1", runId: "run-1", stepName: "research", status: "completed", output: "brief" });

    writeStateSnapshot(runsDir, "run-1", store);

    const written = JSON.parse(fs.readFileSync(path.join(runsDir, "run-1", "state.json"), "utf-8"));
    expect(written.run.id).toBe("run-1");
    expect(written.steps).toHaveLength(1);
    expect(written.steps[0].output).toBe("brief");
  });
});

describe("writeArtifacts", () => {
  let runsDir: string;

  beforeEach(() => {
    runsDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-artifacts-"));
  });

  afterEach(() => {
    fs.rmSync(runsDir, { recursive: true, force: true });
  });

  it("writes one file per step that has both an output and a declared deliverable", () => {
    const stepOutputs = new Map([
      ["research", "research findings"],
      ["write-script", "script text"],
    ]);
    const deliverables = new Map([
      ["research", "research-brief.md"],
      ["write-script", "script.md"],
    ]);

    writeArtifacts(runsDir, "run-1", stepOutputs, deliverables);

    const dir = path.join(runsDir, "run-1", "artifacts");
    expect(fs.readFileSync(path.join(dir, "research-brief.md"), "utf-8")).toBe("research findings");
    expect(fs.readFileSync(path.join(dir, "script.md"), "utf-8")).toBe("script text");
  });

  it("skips a deliverable whose step never produced output (e.g. run stopped early)", () => {
    const stepOutputs = new Map<string, string>(); // nothing completed yet
    const deliverables = new Map([["research", "research-brief.md"]]);

    writeArtifacts(runsDir, "run-1", stepOutputs, deliverables);

    expect(fs.existsSync(path.join(runsDir, "run-1", "artifacts"))).toBe(false);
  });
});
