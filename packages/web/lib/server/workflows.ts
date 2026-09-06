import fs from "node:fs";
import path from "node:path";
import { parse as parseYAML, stringify as stringifyYAML } from "yaml";
import { parseEmployee, parseWorkflow, type Employee, type Workflow } from "@open-work/core";
import { CONFIG_DIR } from "./paths";

function readYamlFiles(dir: string): { name: string; raw: unknown }[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => ({
      name: f.replace(/\.ya?ml$/, ""),
      raw: parseYAML(fs.readFileSync(path.join(dir, f), "utf-8")),
    }));
}

export function listWorkflows(): Workflow[] {
  return readYamlFiles(path.join(CONFIG_DIR, "workflows")).map(({ raw }) => parseWorkflow(raw));
}

// Workflow/employee names become filenames on disk. Without this, a name
// like "../../evil" (from the builder form, or any client of these API
// routes) reads or writes outside config/workflows/ entirely.
const SAFE_NAME = /^[a-z0-9][a-z0-9_-]*$/i;

function assertSafeFileName(name: string): void {
  if (!SAFE_NAME.test(name)) {
    throw new Error(
      `Invalid name "${name}" — use only letters, numbers, hyphens, and underscores`,
    );
  }
}

export function getWorkflow(name: string): Workflow | undefined {
  assertSafeFileName(name);
  const filePath = path.join(CONFIG_DIR, "workflows", `${name}.yaml`);
  if (!fs.existsSync(filePath)) return undefined;
  return parseWorkflow(parseYAML(fs.readFileSync(filePath, "utf-8")));
}

export function listEmployees(): Employee[] {
  return readYamlFiles(path.join(CONFIG_DIR, "employees")).map(({ raw }) => parseEmployee(raw));
}

export function saveWorkflow(workflow: Workflow, yamlText: string, options: { overwrite?: boolean } = {}): void {
  assertSafeFileName(workflow.name);
  const dir = path.join(CONFIG_DIR, "workflows");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${workflow.name}.yaml`);

  // A developer's hand-written, git-committed YAML is the source of truth
  // (CLAUDE.md) — the builder UI must never silently clobber it.
  if (!options.overwrite && fs.existsSync(filePath)) {
    throw new Error(`A workflow named "${workflow.name}" already exists. Choose a different name.`);
  }

  // Validate before writing — never save something open-work run can't load.
  parseWorkflow(parseYAML(yamlText));
  fs.writeFileSync(filePath, yamlText);
}

export interface WorkflowFormInput {
  name: string;
  description?: string;
  steps: Array<{
    name: string;
    employee: string;
    objective: string;
    constraints?: string[];
    dependsOn?: string;
    deliverable?: string;
  }>;
  /** Adds a human approval step after the last agent step, when provided. */
  approval?: {
    maxAttempts: number;
  };
}

/**
 * Turns the form builder's picks into the exact same YAML shape a developer
 * would hand-write (see the `architecture` skill's workflow reference) —
 * the UI is a generator for that file, never a separate format (CLAUDE.md's
 * dual-interface decision).
 */
export function buildWorkflowFromForm(input: WorkflowFormInput): { workflow: Workflow; yamlText: string } {
  if (!input.name.trim()) throw new Error("Workflow name is required");
  assertSafeFileName(input.name);
  if (input.steps.length === 0) throw new Error("At least one step is required");
  for (const step of input.steps) {
    // step.employee ends up read as config/employees/<employee>.yaml
    // (see lib/server/executor.ts's loadEmployee) — same path-traversal
    // concern as the workflow name itself.
    assertSafeFileName(step.employee);
  }

  const stepDocs: Record<string, unknown>[] = input.steps.map((step) => ({
    name: step.name,
    employee: step.employee,
    ...(step.dependsOn ? { depends_on: step.dependsOn } : {}),
    handoff: {
      objective: step.objective,
      ...(step.constraints?.length ? { constraints: step.constraints } : {}),
      ...(step.deliverable ? { deliverable: step.deliverable } : {}),
    },
  }));

  if (input.approval) {
    const lastStep = input.steps[input.steps.length - 1];
    stepDocs.push({
      name: "review",
      assignee: "human",
      action: "approve_or_reject",
      depends_on: lastStep.name,
      on_reject: { resubmit_to: lastStep.name, max_attempts: input.approval.maxAttempts },
    });
  }

  const doc: Record<string, unknown> = {
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    trigger: "manual",
    steps: stepDocs,
  };

  const yamlText = stringifyYAML(doc);
  const workflow = parseWorkflow(parseYAML(yamlText)); // validates before returning
  return { workflow, yamlText };
}
