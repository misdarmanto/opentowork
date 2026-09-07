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
  parseConnector,
  parseEmployee,
  parseSkill,
  writeArtifacts,
  writeStateSnapshot,
  type Connector,
  type Employee,
  type ExecutionState,
  type Skill,
  type Workflow,
} from "@open-work/core";
import { CONFIG_DIR, PROJECT_ROOT, RUNS_DIR } from "./paths";
import { getStore } from "./store";

// Employee/connector/skill names become filenames on disk - same path-traversal
// concern assertSafeFileName in ./workflows.ts guards against for workflow names.
const SAFE_NAME = /^[a-z0-9][a-z0-9_-]*$/i;

function assertSafeFileName(name: string): void {
  if (!SAFE_NAME.test(name)) {
    throw new Error(`Invalid name "${name}" - use only letters, numbers, hyphens, and underscores`);
  }
}

async function loadEmployee(name: string): Promise<Employee> {
  assertSafeFileName(name);
  const filePath = path.join(CONFIG_DIR, "employees", `${name}.yaml`);
  return parseEmployee(parseYAML(fs.readFileSync(filePath, "utf-8")));
}

async function loadConnector(name: string): Promise<Connector> {
  assertSafeFileName(name);
  const filePath = path.join(CONFIG_DIR, "connectors", `${name}.yaml`);
  return parseConnector(parseYAML(fs.readFileSync(filePath, "utf-8")));
}

async function loadSkill(name: string): Promise<Skill> {
  assertSafeFileName(name);
  const filePath = path.join(CONFIG_DIR, "skills", `${name}.yaml`);
  return parseSkill(parseYAML(fs.readFileSync(filePath, "utf-8")));
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
  return new WorkflowExecutor(providers, getStore(), loadEmployee, tracer, PROJECT_ROOT, loadConnector, loadSkill);
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
 * commands exactly - same executor, same store, same file layout. The web
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
