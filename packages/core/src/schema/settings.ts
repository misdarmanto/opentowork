import { z } from "zod";

/** Providers with a real LLMProvider implementation today - see packages/core/src/providers/. */
export const IMPLEMENTED_PROVIDERS = ["anthropic", "deepseek"] as const;

/** All providers an employee's YAML can declare (schema/employee.ts) - openai/google have no implementation yet. */
export const ALL_PROVIDERS = ["anthropic", "openai", "google", "deepseek"] as const;

export const settingsSchema = z.object({
  /** API keys set through the web UI, keyed by provider - override the equivalent environment variable when present. */
  apiKeys: z.record(z.enum(ALL_PROVIDERS), z.string()).default({}),
  /** User-added model names, kept as a convenience list for the employee builder - not a whitelist, any model string still works. */
  customModels: z.array(z.object({ provider: z.enum(ALL_PROVIDERS), name: z.string() })).default([]),
});

export type Settings = z.infer<typeof settingsSchema>;
export type Provider = (typeof ALL_PROVIDERS)[number];

export function parseSettings(raw: unknown): Settings {
  return settingsSchema.parse(raw);
}

export function emptySettings(): Settings {
  return { apiKeys: {}, customModels: [] };
}
