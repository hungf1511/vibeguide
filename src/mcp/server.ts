import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { registerTools, handleToolCall } from "./tools.js";

const server = new Server(
  {
    name: "vibeguide",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[MCP] Listing tools...");
  return { tools: registerTools() };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.error(`[MCP] Tool call: ${request.params.name}`);
  try {
    const result = await handleToolCall(request.params.name, request.params.arguments ?? {});
    console.error(`[MCP] Tool call OK: ${request.params.name}`);
    return result;
  } catch (err: any) {
    console.error(`[MCP] Tool call ERROR: ${request.params.name} -`, err.message);
    throw err;
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("VibeGuide MCP Server running on stdio");
}

main().catch((err) => {
  console.error("MCP Server error:", err);
  process.exit(1);
});
