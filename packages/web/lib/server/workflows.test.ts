import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWorkflowFromForm, getWorkflow, saveWorkflow } from "./workflows";
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
