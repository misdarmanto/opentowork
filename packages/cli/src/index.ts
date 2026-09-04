#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { parse as parseYAML } from "yaml";
import {
  parseEmployee,
  parseWorkflow,
  ProviderFactory,
  AnthropicProvider,
  RunStore,
  WorkflowExecutor,
  type Employee,
} from "@open-work/core";

const CONFIG_DIR = path.resolve(process.cwd(), "config");
const STATE_DIR = path.resolve(process.cwd(), ".open-work");

function ensureStateDir(): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function loadWorkflowFile(name: string) {
  const filePath = name.endsWith(".yaml") ? path.resolve(process.cwd(), name) : path.join(CONFIG_DIR, "workflows", `${name}.yaml`);
  const raw = parseYAML(fs.readFileSync(filePath, "utf-8"));
  return parseWorkflow(raw);
}

async function loadEmployee(name: string): Promise<Employee> {
  const filePath = path.join(CONFIG_DIR, "employees", `${name}.yaml`);
  const raw = parseYAML(fs.readFileSync(filePath, "utf-8"));
  return parseEmployee(raw);
}

function buildProviderFactory(): ProviderFactory {
  const factory = new ProviderFactory();
  if (process.env.ANTHROPIC_API_KEY) {
    factory.register("anthropic", new AnthropicProvider(), { apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return factory;
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
  .option("-p, --param <key=value...>", "template params, e.g. topic=\"AI agents\"", [])
  .description("Run a workflow end-to-end")
  .action(async (workflow: string, opts: { param: string[] }) => {
    ensureStateDir();
    const params: Record<string, string> = {};
    for (const p of opts.param) {
      const [key, ...rest] = p.split("=");
      params[key] = rest.join("=");
    }

    const parsed = loadWorkflowFile(workflow);
    const providers = buildProviderFactory();
    const store = new RunStore(path.join(STATE_DIR, "db.sqlite"));
    const executor = new WorkflowExecutor(providers, store, loadEmployee, {
      log: (entry) => console.log(JSON.stringify(entry)),
    });

    const state = await executor.run(parsed, params);
    console.log(`\nRun ${state.runId} finished with status: ${state.status}`);
  });

program
  .command("resume")
  .argument("<runId>", "run id to resume")
  .description("Resume an interrupted or awaiting-approval run (not yet implemented)")
  .action((runId: string) => {
    console.log(`resume for run ${runId} is not implemented yet — tracked in CLAUDE.md open questions`);
  });

program.parseAsync();
