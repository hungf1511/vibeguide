import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import * as scanner from "../src/utils/scanner.js";

vi.mock("../src/utils/scanner.js", async () => {
  const actual = await vi.importActual<typeof import("../src/utils/scanner.js")>("../src/utils/scanner.js");
  return {
    ...actual,
    getAllSourceFiles: vi.fn(() => ["src/app.ts"]),
    getFileContent: vi.fn(() => `const x = 1`),
    getGitStatus: vi.fn(() => ({ available: true, branch: "main", modified: [], staged: [], untracked: [], ahead: 0 })),
    getRepoSignature: vi.fn(() => "sig"),
    scanDependencies: vi.fn(async () => ({ nodes: ["a.ts"], edges: [{ from: "a.ts", to: "b.ts" }] })),
  };
});

vi.mock("../src/mcp/handlers/snapshotDiff.js", () => ({
  handleDiffSummary: vi.fn(() => Promise.resolve({ summary: "ok", filesChanged: [], riskAssessment: "low", totalFiles: 0 })),
}));

vi.mock("../src/utils/pathGuard.js", () => ({
  resolveRepo: vi.fn((p?: string) => p || "/repo"),
}));

vi.mock("../src/utils/configLoader.js", () => ({
  loadConfig: vi.fn(() => ({ severityThresholds: { deployBlock: "critical", needsApproval: "high" }, criticalFeatures: [] })),
  detectFramework: vi.fn(() => "generic"),
  getEntryPointPatterns: vi.fn(() => []),
}));

vi.mock("../src/utils/vulnerabilityScanner.js", () => ({
  checkKnownVulnerabilities: vi.fn(() => []),
}));

vi.mock("../src/utils/cache.js", () => ({
  getIfFresh: vi.fn(() => null),
  set: vi.fn(),
}));

vi.mock("../src/utils/snapshot.js", () => ({
  createSnapshot: vi.fn(() => ({ snapshotId: "snap-1" })),
}));

vi.mock("../src/utils/changelog.js", () => ({
  generateChangelog: vi.fn(() => ({ sections: [] })),
}));

vi.mock("../src/utils/qualityChecks.js", () => ({
  runTypeCheck: vi.fn(() => ({ passed: true, errorCount: 0, summary: "ok" })),
}));

vi.mock("../src/utils/codeAnalysis.js", () => ({
  findCircularDeps: vi.fn(() => ({ cycles: [] })),
  scanSecrets: vi.fn(() => ({ findings: [], summary: "ok", scannedFiles: 1 })),
}));

vi.mock("../src/utils/heuristics.js", () => ({
  matchPatterns: vi.fn(() => []),
  BUG_PATTERNS: {},
}));

import { handleDeployCheck } from "../src/mcp/handlers/deploy.js";
import { handleImpact, handleImpactConfirm } from "../src/mcp/handlers/impact.js";
import { handleFounderBrief, handleMeetingNotes } from "../src/mcp/handlers/briefing.js";
import { handleReviewPr } from "../src/mcp/handlers/review.js";
import { getSession } from "../src/utils/sessionContext.js";
import { analyzeMonorepo } from "../src/utils/monorepo.js";

describe("deploy branches", () => {
  it("passes with no issues", async () => {

    const result = await handleDeployCheck({ repoPath: "/repo" });
    expect(result.passed).toBe(true);
  });

  it("skips bug patterns", async () => {
    const result = await handleDeployCheck({ repoPath: "/repo", checkBugPatterns: false });
    expect(result.checks.every((c) => c.name !== "Bug Patterns")).toBe(true);
  });

  it("skips uncommitted", async () => {
    const result = await handleDeployCheck({ repoPath: "/repo", checkUncommitted: false });
    expect(result.checks.every((c) => c.name !== "Uncommitted Changes")).toBe(true);
  });

  it("skips orphans", async () => {
    const result = await handleDeployCheck({ repoPath: "/repo", checkOrphans: false });
    expect(result.checks.every((c) => c.name !== "Orphaned Files")).toBe(true);
  });
});

describe("impact branches", () => {
  it("returns low risk", async () => {
    const result = await handleImpact({ filePath: "src/a.ts", repoPath: "/repo" });
    expect(result.risk).toBe("low");
  });

  it("creates auto snapshot", async () => {
    const result = await handleImpact({ filePath: "src/a.ts", repoPath: "/repo", autoSnapshot: true });
    expect(result.autoSnapshotId).toBeDefined();
  });

  it("skips auto snapshot", async () => {
    const result = await handleImpact({ filePath: "src/a.ts", repoPath: "/repo", autoSnapshot: false });
    expect(result.autoSnapshotId).toBeUndefined();
  });

  it("returns needsApproval false for low risk", async () => {
    const result = await handleImpactConfirm({ filePath: "src/a.ts", repoPath: "/repo" });
    expect(result.needsApproval).toBe(false);
  });
});

describe("briefing branches", () => {
  it("returns brief", async () => {
    const result = await handleFounderBrief({ repoPath: "/repo" });
    expect(result.brief).toBeDefined();
  });

  it("returns meeting notes", async () => {
    const result = await handleMeetingNotes({ repoPath: "/repo" });
    expect(result.notes).toBeDefined();
  });
});

describe("review branches", () => {
  it("reviews without filePath", async () => {
    const result = await handleReviewPr({ repoPath: "/repo" });
    expect(result.passed).toBe(true);
  });

  it("reviews with filePath", async () => {
    const result = await handleReviewPr({ repoPath: "/repo", filePath: "src/a.ts" });
    expect(result.sections.length).toBeGreaterThan(0);
  });
});

describe("deploy branches dirty detection", () => {
  it("warns when only staged files exist", async () => {
    vi.mocked(scanner.getGitStatus).mockReturnValue({ available: true, branch: "main", modified: [], staged: ["new.ts"], untracked: [], ahead: 0 });
    const result = await handleDeployCheck({ repoPath: "/repo", checkUncommitted: true });
    const uncommitted = result.checks.find(c => c.name.includes("Uncommitted") || c.name.includes("Commit"));
    expect(uncommitted?.passed).toBe(false);
    expect(uncommitted?.severity).toBe("warning");
    vi.mocked(scanner.getGitStatus).mockReturnValue({ available: true, branch: "main", modified: [], staged: [], untracked: [], ahead: 0 });
  });

  it("warns when only untracked files exist", async () => {
    vi.mocked(scanner.getGitStatus).mockReturnValue({ available: true, branch: "main", modified: [], staged: [], untracked: ["a.ts"], ahead: 0 });
    const result = await handleDeployCheck({ repoPath: "/repo", checkUncommitted: true });
    const uncommitted = result.checks.find(c => c.name.includes("Uncommitted") || c.name.includes("Commit"));
    expect(uncommitted?.passed).toBe(false);
    expect(uncommitted?.severity).toBe("warning");
    vi.mocked(scanner.getGitStatus).mockReturnValue({ available: true, branch: "main", modified: [], staged: [], untracked: [], ahead: 0 });
  });
});

describe("monorepo branches", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-mono-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects single repo", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "root" }), "utf-8");
    const result = analyzeMonorepo(tmpDir, ["src/index.ts"]);
    expect(result.isMonorepo).toBe(false);
  });

  it("detects monorepo with workspaces", () => {
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "root", workspaces: ["apps/*"] }), "utf-8");
    fs.mkdirSync(path.join(tmpDir, "apps", "web"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "apps", "web", "package.json"), JSON.stringify({ name: "web" }), "utf-8");
    const result = analyzeMonorepo(tmpDir, ["apps/web/index.ts"]);
    expect(result.packages.length).toBeGreaterThanOrEqual(1);
  });
});
