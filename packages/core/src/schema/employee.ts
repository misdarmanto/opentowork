import { z } from "zod";

const toolConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("mcp"),
    name: z.string(),
    endpoint: z.string().optional(),
    credentials_from: z.string().optional(),
  }),
  z.object({
    type: z.literal("custom"),
    name: z.string(),
    path: z.string(),
    timeout: z.number().optional(),
  }),
  z.object({
    type: z.literal("builtin"),
    name: z.string(),
    context: z.string().optional(),
  }),
]);

export const employeeSchema = z.object({
  name: z.string(),
  role: z.string(),
  department: z.string().optional(),
  description: z.string().optional(),

  provider: z.enum(["anthropic", "openai", "google", "deepseek"]),
  model: z.string(),
  model_config: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      max_tokens: z.number().positive().optional(),
      top_p: z.number().min(0).max(1).optional(),
    })
    .optional(),

  budget: z
    .object({
      tokens_per_month: z.number().positive().optional(),
      max_cost_per_run: z.number().positive().optional(),
    })
    .optional(),

  skills: z.array(z.string()).default([]),
  tools: z.array(toolConfigSchema).default([]),

  constraints: z
    .object({
      max_turns: z.number().int().positive().default(10),
      max_depth: z.number().int().positive().default(3),
      timeout_seconds: z.number().int().positive().default(300),
    })
    .default({ max_turns: 10, max_depth: 3, timeout_seconds: 300 }),

  success_criteria: z.array(z.string()).default([]),
});

export type Employee = z.infer<typeof employeeSchema>;
export type ToolConfig = z.infer<typeof toolConfigSchema>;

export function parseEmployee(raw: unknown): Employee {
  return employeeSchema.parse(raw);
}
