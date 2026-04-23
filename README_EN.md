# VibeGuide — MCP Server for AI Developer & Non-Tech Founder

[🇻🇳 Tiếng Việt](README.md) | [🇺🇸 English](README_EN.md)

VibeGuide bridges the gap between AI Developer (Claude Code) and Non-Tech Founder to break the endless fix-code loop. It provides 18 MCP tools that help AI understand codebases, assess risks, plan tests, and recommend appropriate Claude Code plugins — all output in plain language.

## Why VibeGuide?

When a Founder says "the Pay button doesn't work", AI Developer usually:
- Guesses a fix → test fails → fix again → repeat endlessly
- Doesn't know the impact of changes on other features
- Has no clear test plan for the Founder to verify

VibeGuide solves all of this.

## 18 Tools

### Core — Understand the codebase
- `vibeguide_scan_repo` — Scan repo structure, dependency graph
- `vibeguide_get_deps` — Extract dependency graph
- `vibeguide_get_file` — Read file safely (path traversal protection)
- `vibeguide_dependency_graph` — Export dependencies as Mermaid diagram
- `vibeguide_trace_journey` — Trace user journey through the codebase

### Bug Detection — Find bugs before fixing
- `vibeguide_heuristic_bug` — Scan bug patterns (unawaited-fetch, missing-try-catch, console-log, hardcoded-secret, any-type, sql-injection, eval-usage)
- `vibeguide_bug_report` — Format bug report with severity assessment
- `vibeguide_suggest_fix` — Suggest concrete fixes with explanations

### Impact Analysis — Assess risk
- `vibeguide_impact` — Analyze impact of changing a file
- `vibeguide_impact_confirm` — Estimate downtime, needs approval?
- `vibeguide_regression` — Check regression after fix

### Planning — Plan ahead
- `vibeguide_test_plan` — Generate test plan for Founder
- `vibeguide_snapshot` — Snapshot repo before editing (create/list/restore)
- `vibeguide_deploy_check` — Pre-deploy validation (bug patterns, uncommitted changes, orphans)

### Changelog & Summary — Report to Founder
- `vibeguide_changelog` — Generate changelog from git history
- `vibeguide_diff_summary` — Summarize code changes for non-tech users
- `vibeguide_what_changed` — View recent commits/files/changes

### Smart Routing — Recommend Claude Code plugins
- `vibeguide_smart_route` — Based on situation, recommend plugin + VibeGuide tools. Supports Vietnamese and English. Auto-detects installed plugins.

## Installation

```bash
git clone https://github.com/<user>/vibeguide.git
cd vibeguide
npm install
npm run build
```

## Connect to Claude Code

Add to `~/.mcp.json` (or `.mcp.json` in your project):

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

Then type `/mcp` in Claude Code to connect.

## Testing

```bash
node test-mcp.cjs          # 35 assertions
node test-wipter-scenario.cjs  # Real-world scenario
node test-batch2.cjs        # Batch 2 tools
```

## Real-world Workflow

```
Founder: "Pay button doesn't work"
        ↓
[Dev] vibeguide_smart_route → detect bug + recommend tools
[Dev] vibeguide_heuristic_bug → find 2 bug patterns
[Dev] vibeguide_trace_journey → trace payment flow
[Dev] vibeguide_impact → assess medium risk
[Dev] vibeguide_impact_confirm → Founder needs to approve 1-day downtime
[Dev] vibeguide_test_plan → 6 test steps for Founder
[Dev] vibeguide_snapshot → backup before fixing
[Founder test → Pass]
[Dev] vibeguide_deploy_check → pre-deploy validation
[Deploy successful]
```

## Tech Stack

- TypeScript + ESM
- MCP SDK (@modelcontextprotocol/sdk)
- Zod schemas
- No database — JSON file cache
- SHA-256 snapshots

## License

MIT
