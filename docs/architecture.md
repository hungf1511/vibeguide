# VibeGuide Architecture

## Overview

VibeGuide is a TypeScript MCP (Model Context Protocol) server that bridges AI developers and non-technical founders. It provides 34+ tools for repository analysis, quality checks, impact analysis, and reporting.

## Layered Architecture

```
┌─────────────────────────────────────────┐
│ Transport: MCP stdio / CLI / HTTP       │  Layer 3
├─────────────────────────────────────────┤
│ Tools: 34 MCP tools (thin wrappers)     │  Layer 2
├─────────────────────────────────────────┤
│ Utils: scanner, cache, analyzer, report │  Layer 1
├─────────────────────────────────────────┤
│ Sources: Git / Filesystem / Tree-sitter │  Layer 0
└─────────────────────────────────────────┘
```

## Directory Structure

- `src/mcp/` — MCP server, tool registry, schemas, handlers
  - `handlers/` — Per-tool or per-group handler files
    - `bug.ts` — Bug heuristic + test plan
    - `deploy.ts` — Deploy readiness checks
    - `impact.ts` — Impact analysis
    - `repo.ts` — Repo scanning, diff, changelog
    - `quality.ts` — Type check, coverage, complexity, a11y, doc gap, perf budget
    - `analysis.ts` — Circular deps, dead code, secret scan, i18n gap
    - `review.ts` — PR review aggregator
    - `briefing.ts` — Founder brief, meeting notes
    - `monorepo.ts` — Monorepo route
    - `session.ts` — Session status, export report, smart route
  - `tools.ts` — Central registry mapping tool name → handler
  - `toolSchemas.ts` — Zod schemas for all tools
  - `toolDescriptions.ts` — Bilingual tool descriptions
  - `toolOutput.ts` — Context-budget compression
- `src/utils/` — Core utilities
  - `scanner.ts` — File walking, dependency graph (regex-based, JS-only)
  - `cache.ts` — JSON file cache with signature invalidation
  - `snapshot.ts` — Full-content snapshots
  - `monorepo.ts` — Workspace detection (pnpm/nx/turbo/yarn)
  - `sessionContext.ts` — Session timeline tracking
  - `qualityChecks.ts` — Type check, coverage, complexity, doc gap, perf budget
  - `codeAnalysis.ts` — Circular deps, dead code, a11y, secrets, i18n gap
  - `pathGuard.ts` — Path traversal protection
- `src/types.ts` — All TypeScript interfaces

## Data Flow

1. MCP client calls tool via `handleToolCall(name, args)`
2. `tools.ts` validates args with Zod schema
3. Handler executes business logic via `src/utils/`
4. Output is logged to session context (if repoPath provided)
5. Output is compressed if it exceeds token budget
6. Result returned as MCP text content

## Known Bottlenecks (v1.0)

| ID | Location | Issue | Phase Fix |
|---|---|---|---|
| BN1 | `scanner.ts:118` | Regex import parser is JS-only | Phase 2 |
| BN2 | `scanner.ts:44-53` | Cache signature = fileCount + Σmtime | Phase 1 |
| BN3 | `snapshot.ts:62-91` | Full content JSON snapshots | Phase 1 |
| BN4 | `sessionContext.ts:67` | Unbounded events array | Phase 0 |
| BN5 | `tools.ts:119-126` | Post-hoc compression | Phase 6 |
| BN6 | `newHandlers.ts` | 14 handlers in one file | Phase 0 |
| BN7 | `cache.ts:5`, `snapshot.ts:7` | `process.cwd()` coupling | Phase 1 |
