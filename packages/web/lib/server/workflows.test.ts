import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildConnectorFromForm,
  buildEmployeeFromForm,
  buildSkillFromForm,
  buildWorkflowFromForm,
  deleteEmployee,
  getWorkflow,
  listConnectors,
  listEmployees,
  listSkills,
  saveConnector,
  saveEmployee,
  saveSkill,
  saveWorkflow,
} from "./workflows";
import { CONFIG_DIR } from "./paths";

const TEST_NAME = "vitest-tmp-workflow";
const testFilePath = path.join(CONFIG_DIR, "workflows", `${TEST_NAME}.yaml`);

describe("workflow name safety (path traversal / silent overwrite)", () => {
  afterEach(() => {
    if (fs.existsSync(testFilePath)) fs.rmSync(testFilePath);
  });

  it("getWorkflow rejects a path-traversal name instead of reading outside config/workflows", () => {
    expect(() => getWorkflow("../../../etc/passwd")).toThrow(/Invalid name/);
  });

  it("saveWorkflow rejects a path-traversal workflow name, even called directly (not just via the form builder)", () => {
    const maliciousWorkflow = { name: "../../evil", trigger: "manual" as const, steps: [] };
    expect(() => saveWorkflow(maliciousWorkflow, "name: ../../evil\ntrigger: manual\nsteps: []\n")).toThrow(
      /Invalid name/,
    );
  });

  it("buildWorkflowFromForm rejects a path-traversal employee reference", () => {
    expect(() =>
      buildWorkflowFromForm({
        name: "fine-name",
        steps: [{ name: "s1", employee: "../../secrets", objective: "go" }],
      }),
    ).toThrow(/Invalid name/);
  });

  it("saveWorkflow writes a genuinely new workflow", () => {
    const { workflow, yamlText } = buildWorkflowFromForm({
      name: TEST_NAME,
      steps: [{ name: "s1", employee: "x", objective: "go" }],
    });

    saveWorkflow(workflow, yamlText);

    expect(getWorkflow(TEST_NAME)?.name).toBe(TEST_NAME);
  });

  it("saveWorkflow refuses to silently overwrite an existing workflow", () => {
    const { workflow, yamlText } = buildWorkflowFromForm({
      name: TEST_NAME,
      steps: [{ name: "s1", employee: "x", objective: "go" }],
    });
    saveWorkflow(workflow, yamlText);

    expect(() => saveWorkflow(workflow, yamlText)).toThrow(/already exists/);
  });

  it("saveWorkflow overwrites when explicitly told to", () => {
    const { workflow, yamlText } = buildWorkflowFromForm({
      name: TEST_NAME,
      steps: [{ name: "s1", employee: "x", objective: "go" }],
    });
    saveWorkflow(workflow, yamlText);

    const { workflow: updated, yamlText: updatedYaml } = buildWorkflowFromForm({
      name: TEST_NAME,
      steps: [{ name: "s1", employee: "y", objective: "go differently" }],
    });

    expect(() => saveWorkflow(updated, updatedYaml, { overwrite: true })).not.toThrow();
    expect(getWorkflow(TEST_NAME)?.steps[0]).toMatchObject({ employee: "y" });
  });
});

const TEST_EMPLOYEE = "vitest-tmp-employee";
const TEST_CONNECTOR = "vitest-tmp-connector";
const TEST_SKILL = "vitest-tmp-skill";

describe("employee/connector/skill builders", () => {
  afterEach(() => {
    for (const [subdir, name] of [
      ["employees", TEST_EMPLOYEE],
      ["connectors", TEST_CONNECTOR],
      ["skills", TEST_SKILL],
    ]) {
      const filePath = path.join(CONFIG_DIR, subdir, `${name}.yaml`);
      if (fs.existsSync(filePath)) fs.rmSync(filePath);
    }
  });

  it("buildEmployeeFromForm rejects a path-traversal employee name", () => {
    expect(() =>
      buildEmployeeFromForm({ name: "../../evil", role: "x", provider: "anthropic", model: "m" }),
    ).toThrow(/Invalid name/);
  });

  it("buildEmployeeFromForm rejects a path-traversal skill/connector reference", () => {
    expect(() =>
      buildEmployeeFromForm({
        name: "fine-name",
        role: "x",
        provider: "anthropic",
        model: "m",
        skills: ["../../evil"],
      }),
    ).toThrow(/Invalid name/);
  });

  it("saveEmployee writes a genuinely new employee, referencing skills/connectors by name", () => {
    const { employee, yamlText } = buildEmployeeFromForm({
      name: TEST_EMPLOYEE,
      role: "Researcher",
      provider: "deepseek",
      model: "deepseek-v4-flash",
      skills: ["web-research"],
      connectors: ["duckduckgo"],
      successCriteria: ["cites at least one source"],
    });
    saveEmployee(employee, yamlText);

    const saved = listEmployees().find((e) => e.name === TEST_EMPLOYEE);
    expect(saved?.skills).toEqual(["web-research"]);
    expect(saved?.tools).toEqual([{ type: "connector", connector: "duckduckgo" }]);
    expect(saved?.success_criteria).toEqual(["cites at least one source"]);
  });

  it("saveEmployee refuses to silently overwrite an existing employee", () => {
    const { employee, yamlText } = buildEmployeeFromForm({
      name: TEST_EMPLOYEE,
      role: "Researcher",
      provider: "anthropic",
      model: "claude-sonnet-4",
    });
    saveEmployee(employee, yamlText);
    expect(() => saveEmployee(employee, yamlText)).toThrow(/already exists/);
  });

  it("saveEmployee overwrites when explicitly told to - the path the employee edit modal uses", () => {
    const { employee, yamlText } = buildEmployeeFromForm({
      name: TEST_EMPLOYEE,
      role: "Researcher",
      provider: "anthropic",
      model: "claude-sonnet-4",
    });
    saveEmployee(employee, yamlText);

    const { employee: updated, yamlText: updatedYaml } = buildEmployeeFromForm({
      name: TEST_EMPLOYEE,
      role: "Senior Researcher",
      provider: "anthropic",
      model: "claude-sonnet-4",
    });
    expect(() => saveEmployee(updated, updatedYaml, { overwrite: true })).not.toThrow();

    const saved = listEmployees().find((e) => e.name === TEST_EMPLOYEE);
    expect(saved?.role).toBe("Senior Researcher");
  });

  it("deleteEmployee removes a genuinely existing employee file", () => {
    const { employee, yamlText } = buildEmployeeFromForm({
      name: TEST_EMPLOYEE,
      role: "Researcher",
      provider: "anthropic",
      model: "claude-sonnet-4",
    });
    saveEmployee(employee, yamlText);
    expect(listEmployees().some((e) => e.name === TEST_EMPLOYEE)).toBe(true);

    deleteEmployee(TEST_EMPLOYEE);
    expect(listEmployees().some((e) => e.name === TEST_EMPLOYEE)).toBe(false);
  });

  it("deleteEmployee rejects a path-traversal name instead of deleting outside config/employees", () => {
    expect(() => deleteEmployee("../../../etc/passwd")).toThrow(/Invalid name/);
  });

  it("deleteEmployee throws a clear error for a name that doesn't exist", () => {
    expect(() => deleteEmployee(TEST_EMPLOYEE)).toThrow(/No employee named/);
  });

  it("buildConnectorFromForm rejects a path-traversal connector name", () => {
    expect(() => buildConnectorFromForm({ name: "../../evil", type: "mcp", command: "npx" })).toThrow(
      /Invalid name/,
    );
  });

  it("buildConnectorFromForm rejects a custom connector with no path (fails schema validation)", () => {
    expect(() => buildConnectorFromForm({ name: "fine-name", type: "custom" })).toThrow();
  });

  it("saveConnector writes a genuinely new mcp connector", () => {
    const { connector, yamlText } = buildConnectorFromForm({
      name: TEST_CONNECTOR,
      type: "mcp",
      command: "npx",
      args: ["-y", "some-mcp-server"],
    });
    saveConnector(connector, yamlText);

    const saved = listConnectors().find((c) => c.name === TEST_CONNECTOR);
    expect(saved).toMatchObject({ type: "mcp", command: "npx", args: ["-y", "some-mcp-server"] });
  });

  it("saveConnector refuses to silently overwrite an existing connector", () => {
    const { connector, yamlText } = buildConnectorFromForm({ name: TEST_CONNECTOR, type: "mcp", command: "npx" });
    saveConnector(connector, yamlText);
    expect(() => saveConnector(connector, yamlText)).toThrow(/already exists/);
  });

  it("buildSkillFromForm rejects a path-traversal skill name", () => {
    expect(() => buildSkillFromForm({ name: "../../evil", instructions: "x" })).toThrow(/Invalid name/);
  });

  it("buildSkillFromForm rejects a path-traversal connector reference", () => {
    expect(() =>
      buildSkillFromForm({ name: "fine-name", instructions: "x", connectors: ["../../evil"] }),
    ).toThrow(/Invalid name/);
  });

  it("buildSkillFromForm rejects a skill with no instructions", () => {
    expect(() => buildSkillFromForm({ name: "fine-name", instructions: "" })).toThrow();
  });

  it("saveSkill writes a genuinely new skill with a connector-backed tool", () => {
    const { skill, yamlText } = buildSkillFromForm({
      name: TEST_SKILL,
      instructions: "Prefer primary sources.",
      connectors: ["duckduckgo"],
    });
    saveSkill(skill, yamlText);

    const saved = listSkills().find((s) => s.name === TEST_SKILL);
    expect(saved?.instructions).toBe("Prefer primary sources.");
    expect(saved?.tools).toEqual([{ type: "connector", connector: "duckduckgo" }]);
  });

  it("saveSkill refuses to silently overwrite an existing skill", () => {
    const { skill, yamlText } = buildSkillFromForm({ name: TEST_SKILL, instructions: "Prefer primary sources." });
    saveSkill(skill, yamlText);
    expect(() => saveSkill(skill, yamlText)).toThrow(/already exists/);
  });

  it("saveSkill overwrites when explicitly told to - the path the skill edit modal uses", () => {
    const { skill, yamlText } = buildSkillFromForm({ name: TEST_SKILL, instructions: "Prefer primary sources." });
    saveSkill(skill, yamlText);

    const { skill: updated, yamlText: updatedYaml } = buildSkillFromForm({
      name: TEST_SKILL,
      instructions: "Prefer primary sources, updated.",
    });
    expect(() => saveSkill(updated, updatedYaml, { overwrite: true })).not.toThrow();

    const saved = listSkills().find((s) => s.name === TEST_SKILL);
    expect(saved?.instructions).toBe("Prefer primary sources, updated.");
  });
});
