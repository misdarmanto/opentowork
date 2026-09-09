/**
 * A tool loaded and ready to call, regardless of which of the three channels
 * (MCP, custom, builtin) it came from - see CLAUDE.md "Tools only via" rule.
 * The executor only ever talks to this shape, never to MCP clients or custom
 * tool modules directly.
 */
export interface LoadedTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown): Promise<string>;
  /** Release underlying resources (e.g. an MCP client's subprocess). */
  close?(): Promise<void>;
}
