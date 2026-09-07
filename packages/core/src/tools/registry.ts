import type { Connector } from "../schema/connector.js";
import type { Employee } from "../schema/employee.js";
import type { ToolConfig } from "../schema/tool.js";
import { loadCustomTool } from "./custom.js";
import { loadMcpTools } from "./mcp.js";
import type { LoadedTool } from "./types.js";

export type { LoadedTool } from "./types.js";

/**
 * Loads a named connector definition (config/connectors/<name>.yaml). An
 * injected function rather than a hardcoded file read, matching the
 * EmployeeLoader seam in executor/index.ts — core doesn't own file paths,
 * the CLI/web layer that knows where `config/` lives does.
 */
export type ConnectorLoader = (name: string) => Promise<Connector>;

const NO_CONNECTOR_LOADER: ConnectorLoader = async (name) => {
  throw new Error(
    `Tool references connector "${name}" but no connector loader was configured (see WorkflowExecutor's constructor)`,
  );
};

async function loadOneTool(
  config: Exclude<ToolConfig, { type: "builtin" | "connector" }>,
  projectRoot: string,
): Promise<LoadedTool[]> {
  if (config.type === "custom") return [await loadCustomTool(config, projectRoot)];
  return loadMcpTools(config);
}

/**
 * Loads every tool an employee declares, across all channels (MCP, custom,
 * builtin, or a reference to a reusable connector). Builtin isn't
 * implemented yet — it fails loudly rather than silently granting the
 * employee no tool, per CLAUDE.md's rule that a missing capability must be
 * visible, not silently skipped.
 */
export async function loadToolsForEmployee(
  employee: Employee,
  projectRoot: string,
  loadConnector: ConnectorLoader = NO_CONNECTOR_LOADER,
): Promise<LoadedTool[]> {
  const tools: LoadedTool[] = [];

  for (const config of employee.tools) {
    if (config.type === "builtin") {
      throw new Error(`builtin tool "${config.name}" is not implemented yet (see ROADMAP.md)`);
    }
    if (config.type === "connector") {
      const resolved = await loadConnector(config.connector);
      tools.push(...(await loadOneTool(resolved, projectRoot)));
      continue;
    }
    tools.push(...(await loadOneTool(config, projectRoot)));
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
