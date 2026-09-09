import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolConfig } from "../schema/tool.js";
import type { LoadedTool } from "./types.js";
import { createLogger } from "../logger.js";

const logger = createLogger("tools:custom");

type CustomToolConfig = Extract<ToolConfig, { type: "custom" }>;

interface CustomToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  execute(input: unknown): Promise<unknown>;
}

/**
 * Loads a user-authored tool module. The module must export
 * `defineCustomTool()` returning { name, description, schema, execute } -
 * documented in the `architecture` skill's employee YAML reference.
 */
export async function loadCustomTool(config: CustomToolConfig, projectRoot: string): Promise<LoadedTool> {
  const absolutePath = path.resolve(projectRoot, config.path);
  let mod: unknown;
  try {
    mod = await import(pathToFileURL(absolutePath).href);
  } catch (err) {
    logger.error("custom tool module failed to load", { path: config.path, err });
    throw err;
  }

  if (
    typeof mod !== "object" ||
    mod === null ||
    !("defineCustomTool" in mod) ||
    typeof (mod as { defineCustomTool: unknown }).defineCustomTool !== "function"
  ) {
    throw new Error(`Custom tool at "${config.path}" must export a defineCustomTool() function`);
  }

  const def = (mod as { defineCustomTool: () => CustomToolDefinition }).defineCustomTool();
  const timeoutMs = (config.timeout ?? 30) * 1000;

  return {
    name: def.name,
    description: def.description,
    inputSchema: def.schema,
    async execute(input: unknown): Promise<string> {
      let timer: ReturnType<typeof setTimeout>;
      try {
        const result = await Promise.race([
          def.execute(input),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Tool "${def.name}" timed out after ${timeoutMs}ms`)), timeoutMs);
          }),
        ]);
        return typeof result === "string" ? result : JSON.stringify(result);
      } catch (err) {
        logger.error("custom tool execution failed", { tool: def.name, err });
        throw err;
      } finally {
        // Without this, every successful (non-timed-out) call leaves its
        // timer alive for the full timeout window - up to the default 30s -
        // holding the Node process open that whole time.
        clearTimeout(timer!);
      }
    },
  };
}
