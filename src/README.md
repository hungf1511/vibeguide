# src/

Source root for VibeGuide MCP server.

## Layout

- `analyzers/` — language analyzers (tree-sitter WASM + regex fallback) and SPI.
- `core/git/` — native git wrappers (ls-files, log, diff, blame, status, head).
- `mcp/` — MCP server transport, tool registry, request handlers.
- `utils/` — heuristics, scanner, cache, config, reporting helpers.
- `types.ts` — shared domain types used across layers.

## Entry points

- `mcp/server.ts` — MCP stdio server that the host CLI launches.
- `mcp/handlers/` — one file per tool family; each export is a tool handler.
