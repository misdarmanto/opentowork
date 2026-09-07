import type { Connector } from "../schema/connector.js";
import type { Employee } from "../schema/employee.js";
import type { Skill } from "../schema/skill.js";
import type { ToolConfig } from "../schema/tool.js";
import { loadCustomTool } from "./custom.js";
import { loadMcpTools } from "./mcp.js";
import type { LoadedTool } from "./types.js";

export type { LoadedTool } from "./types.js";

export type ConnectorLoader = (name: string) => Promise<Connector>;
export type SkillLoader = (name: string) => Promise<Skill>;

const NO_CONNECTOR_LOADER: ConnectorLoader = async (name) => {
  throw new Error(
    `Tool references connector "${name}" but no connector loader was configured (see WorkflowExecutor's constructor)`,
  );
};

const NO_SKILL_LOADER: SkillLoader = async (name) => {
  throw new Error(
    `Employee references skill "${name}" but no skill loader was configured (see WorkflowExecutor's constructor)`,
  );
};

async function loadOneTool(
  config: Exclude<ToolConfig, { type: "builtin" | "connector" }>,
  projectRoot: string,
): Promise<LoadedTool[]> {
  if (config.type === "custom") return [await loadCustomTool(config, projectRoot)];
  return loadMcpTools(config);
}

async function resolveToolConfigs(
  configs: ToolConfig[],
  projectRoot: string,
  loadConnector: ConnectorLoader,
): Promise<LoadedTool[]> {
  const tools: LoadedTool[] = [];
  for (const config of configs) {
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

/** Resolves an employee's `skills:` list (by name) into the actual Skill definitions. */
export async function loadSkillsForEmployee(
  employee: Employee,
  loadSkill: SkillLoader = NO_SKILL_LOADER,
): Promise<Skill[]> {
  return Promise.all(employee.skills.map((name) => loadSkill(name)));
}

/**
 * Loads every tool an employee can call: its own `tools:` list plus whatever
 * tools its (already-resolved) skills contribute. Skills are resolved
 * separately via loadSkillsForEmployee — passed in here rather than
 * re-loaded by name — so the caller can also read `skill.instructions` for
 * the system prompt without loading each skill file twice.
 */
export async function loadToolsForEmployee(
  employee: Employee,
  projectRoot: string,
  loadConnector: ConnectorLoader = NO_CONNECTOR_LOADER,
  skills: Skill[] = [],
): Promise<LoadedTool[]> {
  const configs = [...employee.tools, ...skills.flatMap((s) => s.tools)];
  const tools = await resolveToolConfigs(configs, projectRoot, loadConnector);

  // Providers reject (or silently misbehave on) two tools sharing a name in
  // one call — fail loudly here instead, since the likely cause is an
  // employee and one of its skills both pulling in the same connector.
  const seen = new Set<string>();
  for (const tool of tools) {
    if (seen.has(tool.name)) {
      throw new Error(
        `Employee "${employee.name}" ends up with two tools named "${tool.name}" (from its own tools: list ` +
          `and/or one of its skills). Remove the duplicate — likely the same connector listed in both places.`,
      );
    }
    seen.add(tool.name);
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
