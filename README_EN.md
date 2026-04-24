# VibeGuide — MCP Server for AI Developers and Non-Technical Founders

[Tiếng Việt](README.md) | [English](README_EN.md)

VibeGuide is an MCP server that helps AI coding assistants such as Codex or Claude Code understand a codebase before changing it. Instead of guessing, the assistant can scan the repo, find bug patterns, analyze impact, create snapshots, run pre-deploy checks, and produce plain-language reports for non-technical users.

The project currently provides 34 MCP tools, is written in TypeScript, runs locally, and does not require a database. VibeGuide is dogfooded with its own MCP tools before commits.

## Current Status

- Main development branch: `v2-dev`.
- Recommended runtime: Node.js 20+.
- Quality gate: `npm run build`, `npm test`, `npm run test:coverage`, `npm run bench`, `npm run check`.
- CI runs on `main` and `v2-dev`.
- Generated artifacts such as `coverage/`, `dist/`, `cache/`, and private plans under `docs/plans/` should not be committed.

## What VibeGuide Solves

When a Founder says "the Pay button does not work", AI Developers usually face three risks:

- Guessing a fix, failing the test, then repeating the same loop.
- Not knowing which features are affected by a file change.
- Not having a clear test plan for Founder approval before deploy.

VibeGuide turns vague bug reports into a concrete workflow: scan → trace → impact → snapshot → fix → review → deploy check.

## Quick Start

```bash
git clone https://github.com/hungf1511/vibeguide.git
cd vibeguide
npm install
npm run build
npm run check
```

Run the MCP server:

```bash
npm run start
```

## Connect to Codex

Add the server to `C:\Users\User\.codex\config.toml` or your Codex config file:

```toml
[mcp_servers.vibeguide]
command = "node"
args = ["C:/Users/User/vibeguide/dist/mcp/server.js"]
```

Verify:

```bash
codex mcp list
codex mcp get vibeguide
```

After reloading Codex, the `vibeguide_*` tools should be available in the next session.

## Connect to Claude Code

Add this to `~/.mcp.json` or a project-level `.mcp.json`:

```json
{
  "mcpServers": {
    "vibeguide": {
      "command": "node",
      "args": ["/path/to/vibeguide/dist/mcp/server.js"]
    }
  }
}
```

Then open Claude Code and use `/mcp` to verify the connection.

## 34 Tools

### Core — Understand the Codebase

- `vibeguide_scan_repo` — Scan repo structure and dependency graph.
- `vibeguide_get_deps` — Read the scanned dependency graph.
- `vibeguide_get_file` — Read files safely with path traversal protection.
- `vibeguide_dependency_graph` — Export the dependency graph as Mermaid or JSON.
- `vibeguide_trace_journey` — Trace a user journey through related files.

### Bug Detection — Find Bugs Before Fixing

- `vibeguide_heuristic_bug` — Detect patterns such as unawaited fetch, missing try/catch, hardcoded secrets, SQL injection, and `eval`.
- `vibeguide_bug_report` — Format a bug report with severity.
- `vibeguide_suggest_fix` — Suggest a concrete fix for a bug pattern.

### Impact Analysis — Assess Risk

- `vibeguide_impact` — Analyze affected files when changing a file.
- `vibeguide_impact_confirm` — Estimate affected features, downtime, and approval needs.
- `vibeguide_regression` — Check regression risk after changes.

### Planning — Prepare the Change

- `vibeguide_test_plan` — Generate a test plan for a feature.
- `vibeguide_snapshot` — Create, list, or restore snapshots before editing.
- `vibeguide_deploy_check` — Run pre-deploy checks for bug patterns, uncommitted changes, and orphan files.

### Changelog & Summary — Plain-Language Reports

- `vibeguide_changelog` — Generate a Vietnamese changelog from git history.
- `vibeguide_diff_summary` — Summarize the current diff for non-technical users.
- `vibeguide_what_changed` — Show recent commits, files, and changes.

### Session Tracking — Track the Work Session

- `vibeguide_session_status` — Show current session status, changed files, snapshots, and decisions.
- `vibeguide_export_report` — Export the session timeline as Markdown, JSON, or text.

### Smart Routing — Recommend the Right Tool

- `vibeguide_smart_route` — Read a situation description and recommend the next tool/plugin to use.

### Quality & Compliance — Quality Checks

- `vibeguide_type_check` — Run TypeScript checks and report understandable errors.
- `vibeguide_test_coverage` — Read coverage reports and list weak files.
- `vibeguide_circular_deps` — Detect circular imports.
- `vibeguide_dead_code` — Find unused exports and orphan files.
- `vibeguide_complexity` — Analyze LOC and cyclomatic complexity.
- `vibeguide_a11y_check` — Scan basic accessibility issues.
- `vibeguide_secret_scan` — Scan secrets, API keys, and credentials.
- `vibeguide_i18n_gap` — Find missing or extra translation keys across locales.
- `vibeguide_doc_gap` — Find files missing README files and exports missing JSDoc.
- `vibeguide_perf_budget` — Check bundle sizes against a performance budget.

### Monorepo & PR — Pre-Merge Review

- `vibeguide_monorepo_route` — Detect the monorepo manager and affected packages.
- `vibeguide_review_pr` — Run pre-merge checks for type, bug, secret, circular dependency, and impact risks.
- `vibeguide_founder_brief` — Generate a founder-friendly weekly report.
- `vibeguide_meeting_notes` — Generate meeting notes from session context.

## `.vibeguide.json` Configuration

Example:

```json
{
  "framework": "auto",
  "ignorePatterns": [
    "*.test.ts",
    "*.spec.ts",
    "*.bench.ts",
    "*.config.ts",
    "__tests__/**",
    "*.d.ts",
    "coverage",
    "coverage/**",
    "docs/plans",
    "docs/plans/**",
    "tests/fixtures/**",
    "tests/benchmarks/**",
    "test-project/**",
    "test-*.cjs",
    "scripts/**"
  ],
  "thresholds": {
    "bugPatterns": {
      "critical": 0,
      "high": 3,
      "medium": 10
    },
    "orphanFiles": 10,
    "contextBudget": 4000
  },
  "security": {
    "scanDependencies": true,
    "owaspTop10": true
  }
}
```

Important fields:

- `ignorePatterns` excludes fixtures, scripts, generated artifacts, and private plans from scans.
- `thresholds` tunes warnings for bug patterns, orphan files, and context budget.
- `security` enables or disables security-oriented checks.
- `framework` can stay as `auto` when VibeGuide should detect the project type.

## Scope for Large Repos

Some tools accept `scope` to reduce token usage and runtime on large repos:

```json
{
  "scope": {
    "paths": ["src/mcp", "src/core/git"],
    "since": "main",
    "until": "HEAD"
  }
}
```

Supported by:

- `vibeguide_scan_repo`
- `vibeguide_get_deps`
- `vibeguide_dependency_graph`
- `vibeguide_impact`

With `scope`, VibeGuide scans only the relevant slice instead of the whole repo. This is the recommended workflow when using AI agents on larger projects.

## Testing

```bash
npm run build
npm test
npm run test:coverage
npm run bench
npm run check
```

The test suite verifies:

- The MCP registry exposes every current schema-backed tool without hard-coded counts.
- Git-native scanner/log/status/cache behavior, including path scope and generated `coverage/` exclusion.
- P0 coverage gate: lines/statements/functions >= 70%, branches >= 60%.
- Zod schemas are converted to JSON Schema with enum/default/literal/nested object support.
- The tool registry is split from schema, description, and output-compression helpers to reduce complexity.
- `vibeguide_dead_code` avoids false positives from comments, type-only usage, and re-export text.
- `vibeguide_complexity` uses max function complexity and ignores long type-only/static-data files.
- Snapshot restore reverts modified files and deletes files created after the snapshot.
- Diff summary, deploy check, changelog, dependency graph, and suggest fix behavior.
- TypeScript checks use the local compiler when `node_modules/typescript` is available.

## Dogfooding

VibeGuide is used to test VibeGuide itself. A useful self-test loop is:

```bash
vibeguide_scan_repo
vibeguide_type_check
vibeguide_diff_summary
vibeguide_dead_code
vibeguide_review_pr
vibeguide_deploy_check
```

Expected result before commit:

- `vibeguide_type_check` passes.
- `vibeguide_review_pr` has no blockers.
- `vibeguide_dead_code` reports no accidental dead exports outside intentional public APIs.
- `vibeguide_complexity` focuses on complex logic instead of static data or type-only files.
- `vibeguide_deploy_check` only warns when there are uncommitted changes.

## Internal Architecture

VibeGuide keeps the MCP surface stable in `src/mcp/tools.ts`, while support concerns live in smaller modules:

- `src/mcp/toolSchemas.ts` — Zod schemas for all 34 tools.
- `src/mcp/toolDescriptions.ts` — bilingual tool-list descriptions.
- `src/mcp/toolOutput.ts` — output compression for context budget control.
- `src/mcp/zodJsonSchema.ts` — Zod-to-JSON-Schema conversion for MCP.
- `src/utils/codeText.ts` — strips comments, strings, and regex literals before analyzers read source text.

The goal is for `tools.ts` to only orchestrate: register tools, validate input, call handlers, log sessions, and return output.

## Real Workflow

```text
Founder: "The Pay button does not work"
        ↓
vibeguide_smart_route
        ↓
vibeguide_heuristic_bug
        ↓
vibeguide_trace_journey
        ↓
vibeguide_impact + vibeguide_impact_confirm
        ↓
vibeguide_test_plan + vibeguide_snapshot
        ↓
Fix code
        ↓
vibeguide_review_pr + vibeguide_deploy_check
        ↓
Deploy
```

## GitHub Action

VibeGuide can run CI on push/PR:

```yaml
name: VibeGuide Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run test:coverage
      - run: npm run bench
      - run: npm run check
```

## Tech Stack

- TypeScript + ESM.
- MCP SDK `@modelcontextprotocol/sdk`.
- Zod schemas for tool input.
- MCP registry split into schema, description, output-compression, and Zod JSON Schema conversion modules.
- JSON cache/session/snapshot files, no database required.
- SHA-256 checksums for snapshots.
- Git-native scanner/log/status/cache for Phase 1.
- Dogfooding with VibeGuide's own MCP tools.

## License

MIT
