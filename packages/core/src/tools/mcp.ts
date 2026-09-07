import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolConfig } from "../schema/tool.js";
import type { LoadedTool } from "./types.js";

type McpToolConfig = Extract<ToolConfig, { type: "mcp" }>;

/**
 * Connects to one MCP server (stdio transport only for now — see CLAUDE.md's
 * MCP decision) and returns every tool it advertises, each wrapped as a
 * LoadedTool. All returned tools share one underlying client/subprocess;
 * closing any one of them closes the connection for all of them.
 */
export async function loadMcpTools(config: McpToolConfig): Promise<LoadedTool[]> {
  if (!config.command) {
    throw new Error(
      `MCP tool "${config.name}" has no "command" configured — only the stdio transport is implemented (see CLAUDE.md/architecture skill)`,
    );
  }

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  if (config.credentials_from) {
    const envVar = config.credentials_from.replace(/\$\{|\}/g, "");
    if (!process.env[envVar]) {
      throw new Error(`MCP tool "${config.name}" needs env var "${envVar}", which is not set`);
    }
  }

  const transport = new StdioClientTransport({ command: config.command, args: config.args, env });
  const client = new Client({ name: "open-work", version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);

  const { tools } = await client.listTools();
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await client.close();
  };

  return tools.map((tool): LoadedTool => ({
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: tool.inputSchema as Record<string, unknown>,
    async execute(input: unknown): Promise<string> {
      const result = await client.callTool({
        name: tool.name,
        arguments: input as Record<string, unknown>,
      });
      const content = result.content as Array<{ type: string; text?: string }>;
      return content
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text)
        .join("\n");
    },
    close,
  }));
}
