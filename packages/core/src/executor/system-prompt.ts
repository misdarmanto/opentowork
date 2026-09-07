import type { Employee } from "../schema/employee.js";

/**
 * Builds the system prompt actually sent to the LLM for a step. Before this
 * existed, an employee's role/department/success_criteria/system_prompt/
 * context were parsed from YAML and then never used — every agent call sent
 * only the raw objective as a user message, with no persona at all.
 *
 * `extraInstructions` is where resolved skills append their own
 * instructions (see tools/registry.ts) — kept as a parameter rather than
 * read here so this function stays a pure, employee-only concern.
 */
export function buildSystemPrompt(employee: Employee, extraInstructions: string[] = []): string {
  const lines: string[] = [];

  lines.push(`You are ${employee.name}, a ${employee.role}${employee.department ? ` in the ${employee.department} department` : ""}.`);

  if (employee.description) {
    lines.push(employee.description);
  }

  if (employee.system_prompt) {
    lines.push(employee.system_prompt);
  }

  if (employee.context) {
    lines.push(`Reference context:\n${employee.context}`);
  }

  for (const instructions of extraInstructions) {
    lines.push(instructions);
  }

  if (employee.success_criteria.length) {
    lines.push(`Your work is judged against these criteria:\n${employee.success_criteria.map((c) => `- ${c}`).join("\n")}`);
  }

  return lines.join("\n\n");
}
