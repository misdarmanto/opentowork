import fs from "node:fs";
import path from "node:path";
import { parse as parseYAML, stringify as stringifyYAML } from "yaml";
import {
  parseConnector,
  parseEmployee,
  parseSkill,
  parseWorkflow,
  type Connector,
  type Employee,
  type Skill,
  type Workflow,
} from "@open-work/core";
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

export function listConnectors(): Connector[] {
  return readYamlFiles(path.join(CONFIG_DIR, "connectors")).map(({ raw }) => parseConnector(raw));
}

export function listSkills(): Skill[] {
  return readYamlFiles(path.join(CONFIG_DIR, "skills")).map(({ raw }) => parseSkill(raw));
}

/**
 * Writes `yamlText` to `<CONFIG_DIR>/<subdir>/<name>.yaml`, refusing to
 * silently overwrite a hand-written file. `validate` is called on the
 * parsed YAML immediately before the write — same "never save something
 * open-work run can't load" invariant as saveWorkflow.
 */
function saveNamedYaml(
  subdir: string,
  name: string,
  yamlText: string,
  validate: (raw: unknown) => void,
  options: { overwrite?: boolean } = {},
): void {
  assertSafeFileName(name);
  const dir = path.join(CONFIG_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.yaml`);
  if (!options.overwrite && fs.existsSync(filePath)) {
    throw new Error(`A ${subdir.replace(/s$/, "")} named "${name}" already exists. Choose a different name.`);
  }
  validate(parseYAML(yamlText));
  fs.writeFileSync(filePath, yamlText);
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

export interface EmployeeFormInput {
  name: string;
  role: string;
  department?: string;
  description?: string;
  systemPrompt?: string;
  context?: string;
  provider: "anthropic" | "openai" | "google" | "deepseek";
  model: string;
  skills?: string[];
  /** Names of existing connectors (config/connectors/*.yaml) to attach as tools. */
  connectors?: string[];
  successCriteria?: string[];
}

/**
 * Turns the employee builder form into the same YAML shape a developer
 * would hand-write — same dual-interface decision as buildWorkflowFromForm.
 * Deliberately doesn't expose every schema field (model_config/budget/
 * constraints): those default sensibly and are still there to hand-edit
 * once the file exists, same as any other generated YAML.
 */
export function buildEmployeeFromForm(input: EmployeeFormInput): { employee: Employee; yamlText: string } {
  if (!input.name.trim()) throw new Error("Employee name is required");
  assertSafeFileName(input.name);
  if (!input.role.trim()) throw new Error("Role is required");
  if (!input.model.trim()) throw new Error("Model is required");
  for (const skill of input.skills ?? []) assertSafeFileName(skill);
  for (const connector of input.connectors ?? []) assertSafeFileName(connector);

  const doc: Record<string, unknown> = {
    name: input.name,
    role: input.role,
    ...(input.department ? { department: input.department } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.systemPrompt ? { system_prompt: input.systemPrompt } : {}),
    ...(input.context ? { context: input.context } : {}),
    provider: input.provider,
    model: input.model,
    ...(input.skills?.length ? { skills: input.skills } : {}),
    ...(input.connectors?.length
      ? { tools: input.connectors.map((connector) => ({ type: "connector", connector })) }
      : {}),
    ...(input.successCriteria?.length ? { success_criteria: input.successCriteria } : {}),
  };

  const yamlText = stringifyYAML(doc);
  const employee = parseEmployee(parseYAML(yamlText)); // validates before returning
  return { employee, yamlText };
}

export function saveEmployee(employee: Employee, yamlText: string, options: { overwrite?: boolean } = {}): void {
  saveNamedYaml("employees", employee.name, yamlText, parseEmployee, options);
}

export interface ConnectorFormInput {
  name: string;
  type: "mcp" | "custom";
  command?: string;
  args?: string[];
  path?: string;
}

export function buildConnectorFromForm(input: ConnectorFormInput): { connector: Connector; yamlText: string } {
  if (!input.name.trim()) throw new Error("Connector name is required");
  assertSafeFileName(input.name);

  const doc: Record<string, unknown> =
    input.type === "mcp"
      ? {
          type: "mcp",
          name: input.name,
          ...(input.command ? { command: input.command } : {}),
          ...(input.args?.length ? { args: input.args } : {}),
        }
      : { type: "custom", name: input.name, path: input.path };

  const yamlText = stringifyYAML(doc);
  const connector = parseConnector(parseYAML(yamlText)); // validates before returning
  return { connector, yamlText };
}

export function saveConnector(connector: Connector, yamlText: string, options: { overwrite?: boolean } = {}): void {
  saveNamedYaml("connectors", connector.name, yamlText, parseConnector, options);
}

export interface SkillFormInput {
  name: string;
  instructions: string;
  /** Names of existing connectors to attach as tools this skill contributes. */
  connectors?: string[];
}

export function buildSkillFromForm(input: SkillFormInput): { skill: Skill; yamlText: string } {
  if (!input.name.trim()) throw new Error("Skill name is required");
  assertSafeFileName(input.name);
  if (!input.instructions.trim()) throw new Error("Instructions are required");
  for (const connector of input.connectors ?? []) assertSafeFileName(connector);

  const doc: Record<string, unknown> = {
    name: input.name,
    instructions: input.instructions,
    ...(input.connectors?.length
      ? { tools: input.connectors.map((connector) => ({ type: "connector", connector })) }
      : {}),
  };

  const yamlText = stringifyYAML(doc);
  const skill = parseSkill(parseYAML(yamlText)); // validates before returning
  return { skill, yamlText };
}

export function saveSkill(skill: Skill, yamlText: string, options: { overwrite?: boolean } = {}): void {
  saveNamedYaml("skills", skill.name, yamlText, parseSkill, options);
}
