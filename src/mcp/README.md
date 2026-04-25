# src/mcp/

MCP transport layer for VibeGuide.

## Layout

- `server.ts` — MCP stdio server bootstrap.
- `tools.ts` — tool registry: maps tool name → handler.
- `toolSchemas.ts` — Zod schemas for tool input validation.
- `toolDescriptions.ts` — natural-language tool descriptions surfaced to MCP clients.
- `toolOutput.ts` — common output formatting helpers.
- `zodJsonSchema.ts` — Zod → JSON-Schema converter for MCP tool advertisement.
- `handlers/` — per-tool handler implementations.
