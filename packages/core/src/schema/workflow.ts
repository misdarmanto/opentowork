import { z } from "zod";

const handoffSchema = z.object({
  objective: z.string(),
  context: z.string().optional(),
  constraints: z.array(z.string()).default([]),
  deliverable: z.string().optional(),
});

const agentStepSchema = z.object({
  name: z.string(),
  employee: z.string(),
  depends_on: z.string().optional(),
  handoff: handoffSchema,
});

const humanStepSchema = z.object({
  name: z.string(),
  assignee: z.literal("human"),
  depends_on: z.string().optional(),
  action: z.literal("approve_or_reject"),
  on_reject: z
    .object({
      resubmit_to: z.string(),
      max_attempts: z.number().int().positive().default(1),
    })
    .optional(),
});

const stepSchema = z.union([agentStepSchema, humanStepSchema]);

export const workflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  trigger: z.enum(["manual", "scheduled", "webhook"]).default("manual"),
  steps: z.array(stepSchema).min(1),
  on_complete: z
    .array(
      z.record(z.string(), z.unknown()).transform((v) => v),
    )
    .optional(),
});

export type Workflow = z.infer<typeof workflowSchema>;
export type WorkflowStep = z.infer<typeof stepSchema>;
export type AgentStep = z.infer<typeof agentStepSchema>;
export type HumanStep = z.infer<typeof humanStepSchema>;

export function isHumanStep(step: WorkflowStep): step is HumanStep {
  return "assignee" in step && step.assignee === "human";
}

export function parseWorkflow(raw: unknown): Workflow {
  return workflowSchema.parse(raw);
}
