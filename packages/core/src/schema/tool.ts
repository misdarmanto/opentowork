import { z } from "zod";

/**
 * Shared by employee.ts (inline tool configs) and connector.ts (a named,
 * reusable tool config saved to its own config/connectors/<name>.yaml file)
 * - a connector's *content* is exactly one of these two shapes; only the
 * employee-facing union adds "builtin" and "connector" (a reference to one
 * of these files by name).
 */
export const mcpToolSchema = z.object({
  type: z.literal("mcp"),
  name: z.string(),
  // stdio transport (most real MCP servers, e.g. `npx @modelcontextprotocol/server-brave-search`)
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  // streamable-http transport, for servers exposed over HTTP instead
  endpoint: z.string().optional(),
  credentials_from: z.string().optional(),
});

export const customToolSchema = z.object({
  type: z.literal("custom"),
  name: z.string(),
  path: z.string(),
  timeout: z.number().optional(),
});

const builtinToolSchema = z.object({
  type: z.literal("builtin"),
  name: z.string(),
  context: z.string().optional(),
});

const connectorRefSchema = z.object({
  type: z.literal("connector"),
  /** Name of a config/connectors/<connector>.yaml file - resolved at load time. */
  connector: z.string(),
});

export const toolConfigSchema = z.discriminatedUnion("type", [
  mcpToolSchema,
  customToolSchema,
  builtinToolSchema,
  connectorRefSchema,
]);

export type ToolConfig = z.infer<typeof toolConfigSchema>;
export type McpToolConfig = z.infer<typeof mcpToolSchema>;
export type CustomToolConfig = z.infer<typeof customToolSchema>;
export type ConnectorRef = z.infer<typeof connectorRefSchema>;
