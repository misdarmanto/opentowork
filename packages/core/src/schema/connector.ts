import { z } from "zod";
import { customToolSchema, mcpToolSchema } from "./tool.js";

/**
 * A connector is a named, reusable tool definition saved to its own
 * config/connectors/<name>.yaml - content-wise it's exactly one mcp or
 * custom tool config (no "builtin" or "connector" variants: a connector
 * can't reference another connector, and builtin tools aren't meaningfully
 * "shareable" the way an MCP server or a custom script is).
 */
export const connectorSchema = z.discriminatedUnion("type", [mcpToolSchema, customToolSchema]);

export type Connector = z.infer<typeof connectorSchema>;

export function parseConnector(raw: unknown): Connector {
  return connectorSchema.parse(raw);
}
