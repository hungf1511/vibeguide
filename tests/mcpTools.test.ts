import { describe, it, expect } from "vitest";
import * as path from "path";
import { registerTools } from "../src/mcp/tools.js";
import { schemas } from "../src/mcp/toolSchemas.js";
import {
  handleA11yCheck,
  handleBugReport,
  handleChangelog,
  handleCircularDeps,
  handleComplexity,
  handleDeadCode,
  handleDepGraph,
  handleDeployCheck,
  handleGetDeps,
  handleGitLog,
  handleGitStatus,
  handleHeuristicBug,
  handleImpact,
  handleMonorepoRoute,
  handlePerfBudget,
  handleScanRepo,
  handleSecretScanV2,
  handleSuggestFix,
  handleTestPlan,
  handleTraceJourney,
} from "../src/mcp/handlers/index.js";

const ROOT = path.resolve(".");
const TEST_PROJECT = path.resolve("test-project");
const MONOREPO = path.resolve("tests/fixtures/monorepo");

describe("MCP registry", () => {
  it("lists every schema-backed tool without hard-coded counts", () => {
    const tools = registerTools();
    expect(tools).toHaveLength(Object.keys(schemas).length);
    expect(tools.map((t) => t.name)).toContain("vibeguide_git_log");
    const scan = tools.find((t) => t.name === "vibeguide_scan_repo");
    expect(JSON.stringify(scan?.inputSchema)).toContain("scope");
  });
});

describe("MCP handlers", () => {
  it("runs founder-facing scenario tools on the fixture app", async () => {
    const scan = await handleScanRepo({ repoPath: TEST_PROJECT });
    expect(scan.stats.totalFiles).toBeGreaterThan(0);

    const deps = await handleGetDeps({ repoPath: TEST_PROJECT });
    expect(deps.edges.length).toBeGreaterThan(0);

    const bug = await handleHeuristicBug({ repoPath: TEST_PROJECT, symptom: "checkout button not working" });
    expect(bug.totalMatches).toBeGreaterThan(0);

    const impact = await handleImpact({ repoPath: TEST_PROJECT, filePath: "src/hooks/useCart.ts" });
    expect(["low", "medium", "high"]).toContain(impact.risk);

    const trace = await handleTraceJourney({ repoPath: TEST_PROJECT, journey: "user clicks Pay button" });
    expect(trace.files.length).toBeGreaterThan(0);

    const plan = await handleTestPlan({ repoPath: TEST_PROJECT, feature: "checkout" });
    expect(plan.steps.length).toBeGreaterThan(0);

    const report = await handleBugReport({ repoPath: TEST_PROJECT, description: "I click Pay and nothing happens" });
    expect(report.severity).toBe("high");

    const fix = await handleSuggestFix({ repoPath: TEST_PROJECT, filePath: "src/hooks/useCart.ts" });
    expect(fix.suggestions.length).toBeGreaterThan(0);
  });

  it("runs quality and repo tools on VibeGuide itself without scanning generated coverage", async () => {
    const scoped = await handleScanRepo({ repoPath: ROOT, scope: { paths: ["src/core/git"] } });
    expect(scoped.files.every((f) => f.startsWith("src/core/git/"))).toBe(true);
    expect(scoped.files.some((f) => f.startsWith("coverage/"))).toBe(false);

    const graph = await handleDepGraph({ repoPath: ROOT, format: "json", scope: { paths: ["src/core/git"] } });
    expect(graph.nodes).toBeGreaterThan(0);
    expect(graph.mermaid).toContain("src/core/git");

    const complexity = await handleComplexity({ repoPath: ROOT, thresholdComplexity: 15, thresholdLoc: 300 });
    expect(complexity.files.some((f) => f.file.startsWith("coverage/"))).toBe(false);

    const dead = await handleDeadCode({ repoPath: ROOT });
    expect(dead.orphanFiles.some((f) => f.startsWith("coverage/"))).toBe(false);

    const circular = await handleCircularDeps({ repoPath: ROOT });
    expect(circular.cycleCount).toBe(0);

    const secrets = await handleSecretScanV2({ repoPath: ROOT });
    expect(secrets.findings).toEqual([]);

    const a11y = await handleA11yCheck({ repoPath: TEST_PROJECT });
    expect(a11y.scannedFiles).toBeGreaterThan(0);

    const perf = await handlePerfBudget({ repoPath: ROOT, budgetKb: 500 });
    expect(perf.found).toBe(true);
  });

  it("runs git-native tools and deploy checks", async () => {
    const status = await handleGitStatus({ repoPath: ROOT });
    expect(status.shortSha).toMatch(/^[0-9a-f]{7,}$/);

    const log = await handleGitLog({ repoPath: ROOT, count: 2, showFiles: true });
    expect(log.commits[0].sha).not.toBe("--format=");
    expect(log.commits.length).toBeGreaterThan(0);

    const changelog = await handleChangelog({ repoPath: ROOT, count: 2 });
    expect(changelog.raw).toContain("Changelog");

    const monorepo = await handleMonorepoRoute({ repoPath: MONOREPO, changedFiles: ["packages/lib/index.ts"] });
    expect(monorepo.isMonorepo).toBe(true);

    const deploy = await handleDeployCheck({ repoPath: ROOT, checkUncommitted: false });
    expect(deploy.checks.map((c) => c.name)).toContain("Bug Patterns");
  });
});
