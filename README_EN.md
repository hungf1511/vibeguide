# VibeGuide — MCP Server for AI Developer & Non-Tech Founder

[🇻🇳 Tiếng Việt](README.md) | [🇺🇸 English](README_EN.md)

VibeGuide bridges the gap between AI Developer (Claude Code) and Non-Tech Founder to break the endless fix-code loop. It provides 20 MCP tools that help AI understand codebases, assess risks, plan tests, and recommend appropriate Claude Code plugins — all output in plain language.

## Why VibeGuide?

When a Founder says "the Pay button doesn't work", AI Developer usually:
- Guesses a fix → test fails → fix again → repeat endlessly
- Doesn't know the impact of changes on other features
- Has no clear test plan for the Founder to verify

VibeGuide solves all of this.

## 20 Tools

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

### Session Tracking — Track working session
- `vibeguide_session_status` — View current session timeline: status, changed files, snapshot backup, Founder decisions
- `vibeguide_export_report` — Export session report as Markdown/JSON/Text for Notion/Linear

### Smart Routing — Recommend Claude Code plugins
- `vibeguide_smart_route` — Based on situation, recommend plugin + VibeGuide tools. Supports Vietnamese and English. Auto-detects installed plugins.

## Configuration (`.vibeguide.json`)

Create `.vibeguide.json` in repo root to customize:

```json
{
  "criticalFeatures": ["Payment", "Checkout", "Cart", "Auth"],
  "language": "en",
  "outputFormat": "markdown",
  "severityThresholds": {
    "deployBlock": "critical",
    "needsApproval": "high"
  }
}
```

- `criticalFeatures` — AI warns when modifying files related to these features
- `language` — Output language: `"vi"` or `"en"`
- `outputFormat` — Default report format: `"json" | "markdown" | "text"`
- `severityThresholds` — Thresholds for blocking deploy and requiring Founder approval

## GitHub Action

VibeGuide runs CI on every PR (`.github/workflows/vibeguide-check.yml`):

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
      - run: npm run check
      - run: node test-mcp.cjs
```

## Installation

```bash
git clone https://github.com/hungf1511/vibeguide.git
cd vibeguide
npm install
npm run build
npm run check  # VibeGuide self-check via dogfooding
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
node test-mcp.cjs          # 40 assertions — all tools
node test-scenario.cjs     # Real-world scenario (payment button)
node test-future-tools.cjs # Snapshot, diff summary, deploy check
node test-batch2.cjs       # Suggest fix, changelog, dependency graph
npm run check              # VibeGuide self-check (dogfooding)
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
[Dev] vibeguide_session_status → Founder reviews session summary
[Dev] vibeguide_deploy_check → pre-deploy validation
[Deploy successful]
```

## Tech Stack

- TypeScript + ESM
- MCP SDK (@modelcontextprotocol/sdk)
- Zod schemas
- No database — JSON file cache + JSON session tracking
- SHA-256 snapshots
- Dogfooding: `npm run check` self-checks using VibeGuide

## License

MIT
