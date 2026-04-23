import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { registerTools, handleToolCall } from "./tools.js";

function log(message: string, ...args: unknown[]) {
  const extras = args.length ? " " + args.map(String).join(" ") : "";
  process.stderr.write(message + extras + "\n");
}

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
  log("[MCP] Listing tools...");
  return { tools: registerTools() };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  log(`[MCP] Tool call: ${request.params.name}`);
  try {
    const result = await handleToolCall(request.params.name, request.params.arguments ?? {});
    log(`[MCP] Tool call OK: ${request.params.name}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[MCP] Tool call ERROR: ${request.params.name} -`, msg);
    throw err;
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("[MCP] VibeGuide MCP Server running on stdio");
}

main().catch((err) => {
  log("[MCP] MCP Server error:", err);
  process.exit(1);
});
