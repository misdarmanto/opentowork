#!/usr/bin/env node
import { Command } from "commander";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYAML } from "yaml";
import {
  parseConnector,
  parseEmployee,
  parseWorkflow,
  ProviderFactory,
  AnthropicProvider,
  RunStore,
  WorkflowExecutor,
  combineTracers,
  createFileTracer,
  writeArtifacts,
  writeStateSnapshot,
  isHumanStep,
  type Connector,
  type Employee,
  type Workflow,
  type ExecutionState,
} from "@open-work/core";

const PROJECT_ROOT = process.cwd();
const CONFIG_DIR = path.join(PROJECT_ROOT, "config");
const STATE_DIR = path.join(PROJECT_ROOT, ".open-work");
const RUNS_DIR = path.join(STATE_DIR, "runs");

function ensureStateDir(): void {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

function loadWorkflowFile(name: string): Workflow {
  const filePath = name.endsWith(".yaml") ? path.resolve(PROJECT_ROOT, name) : path.join(CONFIG_DIR, "workflows", `${name}.yaml`);
  const raw = parseYAML(fs.readFileSync(filePath, "utf-8"));
  return parseWorkflow(raw);
}

// Employee/connector names become filenames on disk (config/employees/<name>.yaml,
// config/connectors/<name>.yaml). Without this, a name like "../../evil" read from
// workflow/employee YAML would read outside those directories entirely — same
// concern as packages/web/lib/server/workflows.ts's assertSafeFileName.
const SAFE_NAME = /^[a-z0-9][a-z0-9_-]*$/i;

function assertSafeFileName(name: string): void {
  if (!SAFE_NAME.test(name)) {
    throw new Error(`Invalid name "${name}" — use only letters, numbers, hyphens, and underscores`);
  }
}

async function loadEmployee(name: string): Promise<Employee> {
  assertSafeFileName(name);
  const filePath = path.join(CONFIG_DIR, "employees", `${name}.yaml`);
  const raw = parseYAML(fs.readFileSync(filePath, "utf-8"));
  return parseEmployee(raw);
}

async function loadConnector(name: string): Promise<Connector> {
  assertSafeFileName(name);
  const filePath = path.join(CONFIG_DIR, "connectors", `${name}.yaml`);
  const raw = parseYAML(fs.readFileSync(filePath, "utf-8"));
  return parseConnector(raw);
}

function buildProviderFactory(): ProviderFactory {
  const factory = new ProviderFactory();
  if (process.env.ANTHROPIC_API_KEY) {
    factory.register("anthropic", new AnthropicProvider(), { apiKey: process.env.ANTHROPIC_API_KEY });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    // DeepSeek's API is Anthropic-compatible (https://api-docs.deepseek.com/guides/anthropic_api),
    // so the same provider class works — only the base URL and key differ.
    factory.register("deepseek", new AnthropicProvider(), {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: "https://api.deepseek.com/anthropic",
    });
  }
  return factory;
}

function buildExecutor(store: RunStore, runId: string): WorkflowExecutor {
  const providers = buildProviderFactory();
  const tracer = combineTracers({ log: (e) => console.log(JSON.stringify(e)) }, createFileTracer(RUNS_DIR, runId));
  return new WorkflowExecutor(providers, store, loadEmployee, tracer, PROJECT_ROOT, loadConnector);
}

/** step name -> deliverable filename, for every agent step that declares one. */
function deliverablesOf(workflow: Workflow): Map<string, string> {
  const map = new Map<string, string>();
  for (const step of workflow.steps) {
    if (!isHumanStep(step) && step.handoff.deliverable) {
      map.set(step.name, step.handoff.deliverable);
    }
  }
  return map;
}

function persistArtifacts(workflow: Workflow, store: RunStore, state: ExecutionState): void {
  writeStateSnapshot(RUNS_DIR, state.runId, store);
  writeArtifacts(RUNS_DIR, state.runId, state.stepOutputs, deliverablesOf(workflow));
}

function report(state: ExecutionState): void {
  console.log(`\nRun ${state.runId} — status: ${state.status}`);
  if (state.status === "awaiting_approval") {
    console.log(`Waiting on human approval. Use:\n  open-work approve ${state.runId}\n  open-work reject ${state.runId}`);
  }
}

const program = new Command();
program.name("open-work").description("Run teams of AI agents defined in YAML").version("0.1.0");

program
  .command("validate")
  .argument("<workflow>", "workflow name or path to .yaml file")
  .description("Validate a workflow YAML and the employees it references")
  .action((workflow: string) => {
    const parsed = loadWorkflowFile(workflow);
    console.log(`✓ workflow "${parsed.name}" is valid (${parsed.steps.length} steps)`);
  });

program
  .command("run")
  .argument("<workflow>", "workflow name or path to .yaml file")
  .option("-p, --param <key=value...>", 'template params, e.g. topic="AI agents"', [])
  .description("Run a workflow end-to-end (stops at the first human approval step, if any)")
  .action(async (workflow: string, opts: { param: string[] }) => {
    ensureStateDir();
    const params: Record<string, string> = {};
    for (const p of opts.param) {
      const [key, ...rest] = p.split("=");
      params[key] = rest.join("=");
    }

    const parsedWorkflow = loadWorkflowFile(workflow);
    const store = new RunStore(path.join(STATE_DIR, "db.sqlite"));
    const runId = randomUUID();
    const executor = buildExecutor(store, runId);

    const state = await executor.run(parsedWorkflow, params, runId);

    persistArtifacts(parsedWorkflow, store, state);
    report(state);
  });

program
  .command("resume")
  .argument("<runId>", "run id to resume")
  .description("Resume a run that's still 'running' (crashed) or 'awaiting_approval' with no decision made")
  .action(async (runId: string) => {
    ensureStateDir();
    const store = new RunStore(path.join(STATE_DIR, "db.sqlite"));
    const run = store.getRun(runId);
    if (!run) {
      console.error(`No run found with id "${runId}"`);
      process.exitCode = 1;
      return;
    }

    const workflow = loadWorkflowFile(run.workflowName);
    const executor = buildExecutor(store, runId);
    const state = await executor.resume(runId, workflow);

    persistArtifacts(workflow, store, state);
    report(state);
  });

program
  .command("approve")
  .argument("<runId>", "run id with a pending approval")
  .description("Approve the run's current pending step and continue execution")
  .action(async (runId: string) => {
    ensureStateDir();
    const store = new RunStore(path.join(STATE_DIR, "db.sqlite"));
    const run = store.getRun(runId);
    if (!run) {
      console.error(`No run found with id "${runId}"`);
      process.exitCode = 1;
      return;
    }

    const workflow = loadWorkflowFile(run.workflowName);
    const executor = buildExecutor(store, runId);
    const state = await executor.approve(runId, workflow);

    persistArtifacts(workflow, store, state);
    report(state);
  });

program
  .command("reject")
  .argument("<runId>", "run id with a pending approval")
  .description("Reject the run's current pending step (resubmits or fails the run per its on_reject config)")
  .action(async (runId: string) => {
    ensureStateDir();
    const store = new RunStore(path.join(STATE_DIR, "db.sqlite"));
    const run = store.getRun(runId);
    if (!run) {
      console.error(`No run found with id "${runId}"`);
      process.exitCode = 1;
      return;
    }

    const workflow = loadWorkflowFile(run.workflowName);
    const executor = buildExecutor(store, runId);
    const state = await executor.reject(runId, workflow);

    persistArtifacts(workflow, store, state);
    report(state);
  });

program
  .command("approvals")
  .description("List pending approvals")
  .action(() => {
    ensureStateDir();
    const store = new RunStore(path.join(STATE_DIR, "db.sqlite"));
    const pending = store.listPendingApprovals();
    if (pending.length === 0) {
      console.log("No pending approvals.");
      return;
    }
    for (const a of pending) {
      console.log(`${a.runId}  step=${a.stepName}  requested=${a.requestedAt.toISOString()}`);
    }
  });

program.parseAsync();
