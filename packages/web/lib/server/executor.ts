import fs from "node:fs";
import path from "node:path";
import { parse as parseYAML } from "yaml";
import {
  AnthropicProvider,
  ProviderFactory,
  WorkflowExecutor,
  combineTracers,
  createFileTracer,
  isHumanStep,
  parseEmployee,
  writeArtifacts,
  writeStateSnapshot,
  type Employee,
  type ExecutionState,
  type Workflow,
} from "@open-work/core";
import { CONFIG_DIR, PROJECT_ROOT, RUNS_DIR } from "./paths";
import { getStore } from "./store";

async function loadEmployee(name: string): Promise<Employee> {
  const filePath = path.join(CONFIG_DIR, "employees", `${name}.yaml`);
  return parseEmployee(parseYAML(fs.readFileSync(filePath, "utf-8")));
}

function buildProviderFactory(): ProviderFactory {
  const factory = new ProviderFactory();
  if (process.env.ANTHROPIC_API_KEY) {
    factory.register("anthropic", new AnthropicProvider(), { apiKey: process.env.ANTHROPIC_API_KEY });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    factory.register("deepseek", new AnthropicProvider(), {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: "https://api.deepseek.com/anthropic",
    });
  }
  return factory;
}

function buildExecutor(runId: string): WorkflowExecutor {
  const providers = buildProviderFactory();
  const tracer = combineTracers(
    { log: (e) => console.log(JSON.stringify(e)) },
    createFileTracer(RUNS_DIR, runId),
  );
  return new WorkflowExecutor(providers, getStore(), loadEmployee, tracer, PROJECT_ROOT);
}

function deliverablesOf(workflow: Workflow): Map<string, string> {
  const map = new Map<string, string>();
  for (const step of workflow.steps) {
    if (!isHumanStep(step) && step.handoff.deliverable) map.set(step.name, step.handoff.deliverable);
  }
  return map;
}

function persistArtifacts(workflow: Workflow, state: ExecutionState): void {
  writeStateSnapshot(RUNS_DIR, state.runId, getStore());
  writeArtifacts(RUNS_DIR, state.runId, state.stepOutputs, deliverablesOf(workflow));
}

/**
 * These mirror packages/cli/src/index.ts's run/resume/approve/reject
 * commands exactly — same executor, same store, same file layout. The web
 * app is a second *interface*, never a second implementation of what a run
 * does (see CLAUDE.md's dual-interface decision).
 */
export async function triggerRun(
  workflow: Workflow,
  params: Record<string, string>,
  runId: string,
): Promise<ExecutionState> {
  const executor = buildExecutor(runId);
  const state = await executor.run(workflow, params, runId);
  persistArtifacts(workflow, state);
  return state;
}

export async function resumeRun(runId: string, workflow: Workflow): Promise<ExecutionState> {
  const executor = buildExecutor(runId);
  const state = await executor.resume(runId, workflow);
  persistArtifacts(workflow, state);
  return state;
}

export async function approveRun(runId: string, workflow: Workflow): Promise<ExecutionState> {
  const executor = buildExecutor(runId);
  const state = await executor.approve(runId, workflow);
  persistArtifacts(workflow, state);
  return state;
}

export async function rejectRun(runId: string, workflow: Workflow): Promise<ExecutionState> {
  const executor = buildExecutor(runId);
  const state = await executor.reject(runId, workflow);
  persistArtifacts(workflow, state);
  return state;
}
