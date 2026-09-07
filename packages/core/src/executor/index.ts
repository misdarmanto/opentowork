import { randomUUID } from "node:crypto";
import type { Employee } from "../schema/employee.js";
import { isHumanStep, type Workflow, type WorkflowStep } from "../schema/workflow.js";
import type { ProviderFactory } from "../providers/factory.js";
import type { ContentBlock, MessageParam } from "../providers/types.js";
import type { RunStore } from "../store/index.js";
import { closeTools, loadToolsForEmployee, type ConnectorLoader } from "../tools/registry.js";
import { buildSystemPrompt } from "./system-prompt.js";

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
    /** Base directory custom tool `path` entries resolve against (usually the project root, where `config/` lives). */
    private readonly projectRoot: string = process.cwd(),
    /** Resolves a `{type: connector, connector: <name>}` tool reference. Optional — omitting it is fine as long as no employee actually uses one. */
    private readonly loadConnector?: ConnectorLoader,
  ) {}

  /**
   * `runId` can be supplied by the caller (e.g. so a CLI can create a
   * run-scoped file tracer before any step executes) — it otherwise
   * generates one itself.
   */
  async run(workflow: Workflow, params: Record<string, string> = {}, runId: string = randomUUID()): Promise<ExecutionState> {
    this.store.createRun({ id: runId, workflowName: workflow.name, params });

    const state: ExecutionState = {
      runId,
      workflow,
      stepOutputs: new Map(),
      status: "running",
    };

    await this.executeFrom(state, 0, params);
    return state;
  }

  /**
   * Continues a run that's still "running" in the DB (process died
   * mid-step) or "awaiting_approval" with no decision made yet. Rebuilds
   * state entirely from RunStore — SQLite is the durable checkpoint, not
   * any in-memory object — and resumes at the first step that isn't done.
   */
  async resume(runId: string, workflow: Workflow): Promise<ExecutionState> {
    const state = this.rehydrate(runId, workflow);
    if (state.status === "completed" || state.status === "failed") return state;

    // rehydrate() reports the DB's pre-decision status (checked above); once
    // we've decided there's actually work to (re-)drive forward, the state
    // machine's own "running" is what governs executeFrom/executeStep from
    // here — leaving the stale "awaiting_approval" in place would make
    // executeFrom think a still-pending human step it hasn't even reached
    // yet is the one it just paused on, and return immediately.
    state.status = "running";

    const params = this.store.getRunParams(runId);
    const startIndex = this.findResumeIndex(workflow, runId, state.stepOutputs);
    await this.executeFrom(state, startIndex, params);
    return state;
  }

  /** Approves the run's current pending step and continues execution past it. */
  async approve(runId: string, workflow: Workflow, decidedBy = "cli"): Promise<ExecutionState> {
    const pending = this.store.getPendingApprovalForRun(runId);
    if (!pending) throw new Error(`Run "${runId}" has no pending approval`);

    this.store.decideApproval(pending.id, "approved", decidedBy);
    this.tracer.log({ event: "approval_decided", runId, step: pending.stepName, decision: "approved" });

    const state = this.rehydrate(runId, workflow);
    state.status = "running"; // see resume()'s comment on why this can't stay "awaiting_approval"
    const stepIndex = workflow.steps.findIndex((s) => s.name === pending.stepName);
    await this.executeFrom(state, stepIndex + 1, this.store.getRunParams(runId));
    return state;
  }

  /**
   * Rejects the run's current pending step. If it declares `on_reject` and
   * attempts remain, jumps execution back to `resubmit_to` (clearing that
   * step's prior output so it actually re-runs). Otherwise fails the run.
   */
  async reject(runId: string, workflow: Workflow, decidedBy = "cli"): Promise<ExecutionState> {
    const pending = this.store.getPendingApprovalForRun(runId);
    if (!pending) throw new Error(`Run "${runId}" has no pending approval`);

    this.store.decideApproval(pending.id, "rejected", decidedBy);
    this.tracer.log({ event: "approval_decided", runId, step: pending.stepName, decision: "rejected" });

    const step = workflow.steps.find((s) => s.name === pending.stepName);
    const state = this.rehydrate(runId, workflow);
    state.status = "running"; // see resume()'s comment on why this can't stay "awaiting_approval"
    const params = this.store.getRunParams(runId);

    if (step && isHumanStep(step) && step.on_reject) {
      const rejections = this.store.countRejections(runId, pending.stepName);
      if (rejections <= step.on_reject.max_attempts) {
        const resubmitIndex = workflow.steps.findIndex((s) => s.name === step.on_reject!.resubmit_to);
        if (resubmitIndex === -1) {
          throw new Error(
            `on_reject.resubmit_to "${step.on_reject.resubmit_to}" does not exist in workflow "${workflow.name}"`,
          );
        }
        // Durable BEFORE re-executing: if the process crashes mid-retry, a
        // later resume() must not see the old (rejected) output as "done"
        // and skip re-running it. See supersedeCompletedSteps's own comment.
        this.store.supersedeCompletedSteps(runId, step.on_reject.resubmit_to);
        state.stepOutputs.delete(step.on_reject.resubmit_to);
        await this.executeFrom(state, resubmitIndex, params);
        return state;
      }
    }

    state.status = "failed";
    this.store.updateRunStatus(runId, "failed", {
      errorMessage: `Step "${pending.stepName}" rejected and max attempts exceeded`,
    });
    return state;
  }

  /** Rebuilds an ExecutionState purely from what's durably stored — never from memory. */
  private rehydrate(runId: string, workflow: Workflow): ExecutionState {
    const run = this.store.getRun(runId);
    if (!run) throw new Error(`No run found with id "${runId}"`);

    const stepOutputs = new Map<string, string>();
    for (const [name, row] of this.store.getLatestStepsByName(runId)) {
      if (row.status === "completed" && row.output != null) stepOutputs.set(name, row.output);
    }

    return { runId, workflow, stepOutputs, status: run.status as ExecutionState["status"] };
  }

  private findResumeIndex(workflow: Workflow, runId: string, stepOutputs: Map<string, string>): number {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (isHumanStep(step)) {
        if (!this.store.hasApprovedApproval(runId, step.name)) return i;
        continue;
      }
      if (!stepOutputs.has(step.name)) return i;
    }
    return workflow.steps.length;
  }

  private async executeFrom(state: ExecutionState, startIndex: number, params: Record<string, string>): Promise<void> {
    if (startIndex >= state.workflow.steps.length) {
      state.status = "completed";
      this.store.updateRunStatus(state.runId, "completed", { completedAt: new Date() });
      return;
    }

    try {
      let i = startIndex;
      while (i < state.workflow.steps.length) {
        await this.executeStep(state, state.workflow.steps[i], params);
        if (state.status === "awaiting_approval") return;
        i++;
      }
      state.status = "completed";
      this.store.updateRunStatus(state.runId, "completed", { completedAt: new Date() });
    } catch (err) {
      state.status = "failed";
      this.store.updateRunStatus(state.runId, "failed", {
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async executeStep(state: ExecutionState, step: WorkflowStep, params: Record<string, string>): Promise<void> {
    if (isHumanStep(step)) {
      const existingPending = this.store.getPendingApprovalForRun(state.runId);
      if (!existingPending || existingPending.stepName !== step.name) {
        this.store.createApproval({ id: randomUUID(), runId: state.runId, stepName: step.name });
      }
      this.store.updateRunStatus(state.runId, "awaiting_approval");
      state.status = "awaiting_approval";
      this.tracer.log({ event: "awaiting_approval", runId: state.runId, step: step.name });
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

    const output = await this.runAgentLoop(employee, content, state.runId, step.name);

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
    runId: string,
    stepName: string,
  ): Promise<{ artifact: string; inputTokens: number; outputTokens: number; cost: number }> {
    const tools = await loadToolsForEmployee(employee, this.projectRoot, this.loadConnector);
    const toolByName = new Map(tools.map((t) => [t.name, t]));
    const toolSchemas = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
    const system = buildSystemPrompt(employee);

    try {
      const messages: MessageParam[] = [{ role: "user", content: objective }];
      let turn = 0;
      let totalInput = 0;
      let totalOutput = 0;

      while (turn < employee.constraints.max_turns) {
        const response = await this.providers.call(
          employee.provider,
          messages,
          {
            model: employee.model,
            temperature: employee.model_config?.temperature,
            maxTokens: employee.model_config?.max_tokens,
          },
          toolSchemas.length ? toolSchemas : undefined,
          system,
        );

        totalInput += response.usage.inputTokens;
        totalOutput += response.usage.outputTokens;
        turn++;

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

        if (response.stopReason === "tool_use") {
          const toolUseBlocks = response.content.filter(
            (c): c is Extract<ContentBlock, { type: "tool_use" }> => c.type === "tool_use",
          );
          const toolResults: ContentBlock[] = [];

          for (const toolUse of toolUseBlocks) {
            const tool = toolByName.get(toolUse.name);
            this.tracer.log({ event: "tool_call", runId, step: stepName, tool: toolUse.name, input: toolUse.input });

            if (!tool) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Error: tool "${toolUse.name}" is not registered for this employee`,
                is_error: true,
              });
              continue;
            }

            try {
              const result = await tool.execute(toolUse.input);
              toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
            } catch (err) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content: `Error: ${err instanceof Error ? err.message : String(err)}`,
                is_error: true,
              });
            }
          }

          messages.push({ role: "assistant", content: response.content });
          messages.push({ role: "user", content: toolResults });
          continue;
        }

        // Any other stop reason (e.g. max_tokens) is a hard failure rather
        // than a silent partial result — see CLAUDE.md's "don't claim
        // something works" rule applied to the agent's own output.
        throw new Error(`Unhandled stop reason "${response.stopReason}" for employee "${employee.name}"`);
      }

      throw new Error(`Employee "${employee.name}" exceeded max_turns (${employee.constraints.max_turns})`);
    } finally {
      await closeTools(tools);
    }
  }
}

function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);
}
