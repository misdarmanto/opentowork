import fs from "node:fs";
import path from "node:path";
import type { Tracer } from "./index.js";
import type { RunStore } from "../store/index.js";

/**
 * Appends one JSON line per event to `<runsDir>/<runId>/trace.jsonl` — the
 * git-friendly, human-readable audit trail described in the `architecture`
 * skill. SQLite (via RunStore) remains the source of truth resume/approve/
 * reject actually read from; this file is for humans and `git diff`.
 */
export function createFileTracer(runsDir: string, runId: string): Tracer {
  const dir = path.join(runsDir, runId);
  fs.mkdirSync(dir, { recursive: true });
  const tracePath = path.join(dir, "trace.jsonl");

  return {
    log(entry: Record<string, unknown>): void {
      const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
      fs.appendFileSync(tracePath, line + "\n");
    },
  };
}

/** Combines multiple tracers (e.g. console + file) into one. */
export function combineTracers(...tracers: Tracer[]): Tracer {
  return {
    log(entry) {
      for (const t of tracers) t.log(entry);
    },
  };
}

/**
 * Writes `<runsDir>/<runId>/state.json`, a point-in-time snapshot of the run
 * queried fresh from RunStore (never from in-memory ExecutionState) so it
 * always reflects what's actually durable.
 */
export function writeStateSnapshot(runsDir: string, runId: string, store: RunStore): void {
  const dir = path.join(runsDir, runId);
  fs.mkdirSync(dir, { recursive: true });

  const run = store.getRun(runId);
  const steps = store.listSteps(runId);
  const approvals = store.listPendingApprovals().filter((a) => a.runId === runId);

  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ run, steps, approvals }, null, 2));
}

/**
 * Writes each completed step's output to `<runsDir>/<runId>/artifacts/<deliverable>`
 * when the workflow step's handoff names a deliverable file.
 */
export function writeArtifacts(
  runsDir: string,
  runId: string,
  stepOutputs: Map<string, string>,
  deliverables: Map<string, string>,
): void {
  const dir = path.join(runsDir, runId, "artifacts");
  let created = false;

  for (const [stepName, deliverable] of deliverables) {
    const output = stepOutputs.get(stepName);
    if (output === undefined) continue;
    if (!created) {
      fs.mkdirSync(dir, { recursive: true });
      created = true;
    }
    fs.writeFileSync(path.join(dir, deliverable), output);
  }
}
