import { randomUUID } from "node:crypto";
import type { Employee } from "../schema/employee.js";
import { isHumanStep, type Workflow, type WorkflowStep } from "../schema/workflow.js";
import type { ProviderFactory } from "../providers/factory.js";
import type { MessageParam } from "../providers/types.js";
import type { RunStore } from "../store/index.js";

export interface Tracer {
  log(entry: Record<string, unknown>): void;
}

export interface ExecutionState {
  runId: string;
  workflow: Workflow;
  stepOutputs: Map<string, string>;
  status: "running" | "awaiting_approval" | "completed" | "failed";
}

/**
 * Loads an Employee definition by name. Kept as an injected function rather
 * than a hardcoded file read so the CLI (file-based) and web UI (could be
 * DB-backed later) can share this executor without forking it.
 */
export type EmployeeLoader = (name: string) => Promise<Employee>;

export class WorkflowExecutor {
  constructor(
    private readonly providers: ProviderFactory,
    private readonly store: RunStore,
    private readonly loadEmployee: EmployeeLoader,
    private readonly tracer: Tracer,
  ) {}

  async run(workflow: Workflow, params: Record<string, string> = {}): Promise<ExecutionState> {
    const runId = randomUUID();
    this.store.createRun({ id: runId, workflowName: workflow.name });

    const state: ExecutionState = {
      runId,
      workflow,
      stepOutputs: new Map(),
      status: "running",
    };

    try {
      for (const step of workflow.steps) {
        await this.executeStep(state, step, params);
        if (state.status === "awaiting_approval") break;
      }
      if (state.status === "running") {
        state.status = "completed";
        this.store.updateRunStatus(runId, "completed", { completedAt: new Date() });
      }
    } catch (err) {
      state.status = "failed";
      this.store.updateRunStatus(runId, "failed", {
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    return state;
  }

  private async executeStep(state: ExecutionState, step: WorkflowStep, params: Record<string, string>): Promise<void> {
    if (isHumanStep(step)) {
      const approvalId = randomUUID();
      this.store.createApproval({ id: approvalId, runId: state.runId, stepName: step.name });
      this.store.updateRunStatus(state.runId, "awaiting_approval");
      state.status = "awaiting_approval";
      this.tracer.log({ event: "awaiting_approval", runId: state.runId, step: step.name, approvalId });
      return;
    }

    const employee = await this.loadEmployee(step.employee);
    const dependencyOutput = step.depends_on ? state.stepOutputs.get(step.depends_on) : undefined;

    const objective = interpolate(step.handoff.objective, params);
    let content = objective;
    if (dependencyOutput) content += `\n\nPrevious step output:\n${dependencyOutput}`;
    if (step.handoff.context) content += `\n\nContext:\n${interpolate(step.handoff.context, params)}`;
    if (step.handoff.constraints.length) {
      content += `\n\nConstraints:\n${step.handoff.constraints.map((c) => `- ${c}`).join("\n")}`;
    }

    this.tracer.log({ event: "step_started", runId: state.runId, step: step.name, employee: employee.name });

    const output = await this.runAgentLoop(employee, content);

    state.stepOutputs.set(step.name, output.artifact);
    this.store.recordStep({
      id: randomUUID(),
      runId: state.runId,
      stepName: step.name,
      status: "completed",
      inputTokens: output.inputTokens,
      outputTokens: output.outputTokens,
      cost: output.cost,
      output: output.artifact,
    });

    this.tracer.log({
      event: "step_completed",
      runId: state.runId,
      step: step.name,
      tokens: output.inputTokens + output.outputTokens,
      cost: output.cost,
    });
  }

  private async runAgentLoop(
    employee: Employee,
    objective: string,
  ): Promise<{ artifact: string; inputTokens: number; outputTokens: number; cost: number }> {
    const messages: MessageParam[] = [{ role: "user", content: objective }];
    let turn = 0;
    let totalInput = 0;
    let totalOutput = 0;

    while (turn < employee.constraints.max_turns) {
      const response = await this.providers.call(employee.provider, messages, {
        model: employee.model,
        temperature: employee.model_config?.temperature,
        maxTokens: employee.model_config?.max_tokens,
      });

      totalInput += response.usage.inputTokens;
      totalOutput += response.usage.outputTokens;

      if (response.stopReason === "end_turn") {
        const artifact = response.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("\n");

        return {
          artifact,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          cost: this.providers.calculateCost(employee.provider, totalInput, totalOutput, employee.model),
        };
      }

      // MVP: no tool execution loop wired yet — see packages/core/src/tools.
      // A tool_use stop reason without a registered executor is a hard stop
      // rather than a silent skip, so failures are visible in the trace.
      throw new Error(`Unhandled stop reason "${response.stopReason}" for employee "${employee.name}"`);
    }

    throw new Error(`Employee "${employee.name}" exceeded max_turns (${employee.constraints.max_turns})`);
  }
}

function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);
}
