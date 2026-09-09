#!/usr/bin/env node
// A minimal, real MCP server used only by mcp.test.ts, run as a genuine
// child process over stdio - not mocked. Exercises the actual wire protocol
// loadMcpTools() talks to.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "echo-test-server", version: "0.1.0" });

server.registerTool(
  "echo",
  {
    description: "Echoes the given text back, reversed",
    inputSchema: { text: z.string() },
  },
  async ({ text }) => ({
    content: [{ type: "text", text: String(text).split("").reverse().join("") }],
  }),
);

await server.connect(new StdioServerTransport());
