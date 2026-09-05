import type { Employee } from "../schema/employee.js";
import { loadCustomTool } from "./custom.js";
import { loadMcpTools } from "./mcp.js";
import type { LoadedTool } from "./types.js";

export type { LoadedTool } from "./types.js";

/**
 * Loads every tool an employee declares, across all three channels (MCP,
 * custom, builtin). Builtin isn't implemented yet — it fails loudly rather
 * than silently granting the employee no tool, per CLAUDE.md's rule that a
 * missing capability must be visible, not silently skipped.
 */
export async function loadToolsForEmployee(employee: Employee, projectRoot: string): Promise<LoadedTool[]> {
  const tools: LoadedTool[] = [];

  for (const config of employee.tools) {
    if (config.type === "custom") {
      tools.push(await loadCustomTool(config, projectRoot));
    } else if (config.type === "mcp") {
      tools.push(...(await loadMcpTools(config)));
    } else {
      throw new Error(`builtin tool "${config.name}" is not implemented yet (see ROADMAP.md)`);
    }
  }

  return tools;
}

export async function closeTools(tools: LoadedTool[]): Promise<void> {
  const seen = new Set<LoadedTool["close"]>();
  for (const tool of tools) {
    if (tool.close && !seen.has(tool.close)) {
      seen.add(tool.close);
      await tool.close();
    }
  }
}
