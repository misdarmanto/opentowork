import { z } from "zod";
import { toolConfigSchema } from "./tool.js";

export const skillSchema = z.object({
  name: z.string(),
  /** Appended into the employee's system prompt (see buildSystemPrompt's extraInstructions param) whenever the employee lists this skill. */
  instructions: z.string(),
  /** Tools this skill contributes, merged into the employee's own tools when the skill is attached. */
  tools: z.array(toolConfigSchema).default([]),
});

export type Skill = z.infer<typeof skillSchema>;

export function parseSkill(raw: unknown): Skill {
  return skillSchema.parse(raw);
}
