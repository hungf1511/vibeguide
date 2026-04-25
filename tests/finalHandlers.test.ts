import { describe, it, expect, vi, beforeEach } from "vitest";
import * as scanner from "../src/utils/scanner.js";
import * as configLoader from "../src/utils/configLoader.js";
import * as changelog from "../src/utils/changelog.js";
import * as vulnerabilityScanner from "../src/utils/vulnerabilityScanner.js";
import { handleDeployCheck } from "../src/mcp/handlers/deploy.js";
import { handleFounderBrief, handleMeetingNotes } from "../src/mcp/handlers/briefing.js";
import { handleImpact, handleImpactConfirm } from "../src/mcp/handlers/impact.js";
import { handleBugReport, handleSuggestFix, handleRegression as handleBugRegression } from "../src/mcp/handlers/bug.js";

var sessionState: Record<string, any> = {};

vi.mock("../src/utils/scanner.js", async () => {
  const actual = await vi.importActual("../src/utils/scanner.js");
  return {
    ...actual,
    getAllSourceFiles: vi.fn(() => ["src/app.ts"]),
    getFileContent: vi.fn(() => ""),
    getGitStatus: vi.fn(() => ({ available: true, branch: "main", modified: [], staged: [], untracked: [], ahead: 0 })),
    getRepoSignature: vi.fn(() => "sig"),
    scanDependencies: vi.fn(async () => ({ nodes: ["a.ts", "b.ts", "c.ts"], edges: [{ from: "a.ts", to: "b.ts" }] })),
  };
});

vi.mock("../src/utils/pathGuard.js", () => ({
  resolveRepo: vi.fn((p) => p || "/repo"),
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

vi.mock("../src/utils/sessionContext.js", () => ({
  getSession: vi.fn((repo: string) => {
    return sessionState[repo] ?? {
      repo,
      startedAt: "2024-01-01T00:00:00Z",
      status: "idle",
      filesChanged: [],
      testResults: [],
      events: [],
      founderDecisions: [],
    };
  }),
  getTimeline: vi.fn(() => []),
  generateProgressSummary: vi.fn(() => ""),
}));

describe("final handlers branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState = {};
  });

  describe("deploy", () => {
    it("detects critical bug patterns", async () => {
      vi.mocked(scanner.getFileContent).mockReturnValue('eval("bad");');
      const result = await handleDeployCheck({ repoPath: "/repo" });
      const bugCheck = result.checks.find((c) => c.name === "Bug Patterns");
      expect(bugCheck?.passed).toBe(false);
      expect(bugCheck?.severity).toBe("critical");
    });

    it("detects secrets", async () => {
      vi.mocked(scanner.getFileContent).mockReturnValue('const password = "secret12345678"');
      const result = await handleDeployCheck({ repoPath: "/repo" });
      const secretCheck = result.checks.find((c) => c.name === "Hardcoded Secrets");
      expect(secretCheck?.passed).toBe(false);
      expect(secretCheck?.severity).toBe("critical");
    });

    it("blocks on warning threshold", async () => {
      vi.mocked(configLoader.loadConfig).mockReturnValue({ severityThresholds: { deployBlock: "warning" }, criticalFeatures: [] });
      vi.mocked(scanner.getGitStatus).mockReturnValue({ available: true, branch: "main", modified: ["a.ts"], staged: [], untracked: [], ahead: 0 });
      const result = await handleDeployCheck({ repoPath: "/repo" });
      expect(result.summary).toContain("KHONG NEN DEPLOY");
    });

    it("finds dependency vulnerabilities", async () => {
      vi.mocked(vulnerabilityScanner.checkKnownVulnerabilities).mockReturnValue([{ severity: "high", package: "lodash", description: "x" }]);
      const result = await handleDeployCheck({ repoPath: "/repo" });
      const vulnCheck = result.checks.find((c) => c.name === "Dependency Vulnerabilities");
      expect(vulnCheck?.passed).toBe(false);
      expect(vulnCheck?.severity).toBe("high");
    });

    it("finds orphans", async () => {
      vi.mocked(scanner.scanDependencies).mockResolvedValue({ nodes: ["a.ts", "b.ts", "orphan.ts"], edges: [{ from: "a.ts", to: "b.ts" }] });
      const result = await handleDeployCheck({ repoPath: "/repo" });
      const orphanCheck = result.checks.find((c) => c.name === "Orphaned Files");
      expect(orphanCheck?.passed).toBe(false);
    });
  });

  describe("briefing", () => {
    it("brief with status fixing and snapshot reminder", async () => {
      vi.mocked(changelog.generateChangelog).mockReturnValue({ sections: [{ title: "T�nh nang m?i", items: ["feat1", "feat2"] }, { title: "S?a l?i", items: ["fix1"] }] });
      sessionState["/repo"] = {
        repo: "/repo", status: "fixing", filesChanged: ["a.ts"], snapshotId: undefined,
        testResults: [], events: [{ timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_impact", input: {}, output: {} }],
        founderDecisions: [], startedAt: "2024-01-01T00:00:00Z"
      };
      const result = await handleFounderBrief({ repoPath: "/repo" });
      expect(result.brief).toContain("fixing");
      expect(result.nextSteps.some((s) => s.includes("snapshot"))).toBe(true);
      expect(result.highlights).toBeDefined();
    });

    it("brief with status testing", async () => {
      sessionState["/repo"] = {
        repo: "/repo", status: "testing", filesChanged: [], snapshotId: "snap-1",
        testResults: [], events: [], founderDecisions: [], startedAt: "2024-01-01T00:00:00Z"
      };
      const result = await handleFounderBrief({ repoPath: "/repo" });
      expect(result.nextSteps.some((s) => s.includes("test"))).toBe(true);
    });

    it("brief with status deploying", async () => {
      sessionState["/repo"] = {
        repo: "/repo", status: "deploying", filesChanged: [], snapshotId: "snap-1",
        testResults: [], events: [], founderDecisions: [], startedAt: "2024-01-01T00:00:00Z"
      };
      const result = await handleFounderBrief({ repoPath: "/repo" });
      expect(result.nextSteps.some((s) => s.includes("deploy"))).toBe(true);
    });

    it("meeting notes with decisions and modified files", async () => {
      vi.mocked(scanner.getGitStatus).mockReturnValue({ available: true, branch: "main", modified: ["x.ts"], staged: [], untracked: [], ahead: 0 });
      sessionState["/repo"] = {
        repo: "/repo", status: "analyzing", filesChanged: [], snapshotId: undefined,
        testResults: [{ step: 1, passed: true, note: "ok" }, { step: 2, passed: false, note: "fail" }],
        events: [], founderDecisions: [
          { type: "approve", note: "go", timestamp: "2024-01-01T00:00:00Z" },
          { type: "reject", note: "no", timestamp: "2024-01-01T00:00:00Z" },
          { type: "rollback", note: "revert", timestamp: "2024-01-01T00:00:00Z" }
        ], startedAt: "2024-01-01T00:00:00Z"
      };
      const result = await handleMeetingNotes({ repoPath: "/repo" });
      expect(result.done.some((d) => d.includes("go"))).toBe(true);
      expect(result.blockers.some((b) => b.includes("rollback"))).toBe(true);
      expect(result.inProgress.some((i) => i.includes("impact"))).toBe(true);
      expect(result.inProgress.length).toBeGreaterThan(0);
    });
  });

  describe("impact", () => {
    it("confirm affects critical feature", async () => {
      vi.mocked(configLoader.loadConfig).mockReturnValue({ severityThresholds: { needsApproval: "high" }, criticalFeatures: ["Dang nhap"] });
      vi.mocked(scanner.scanDependencies).mockResolvedValue({ nodes: ["login.ts", "a.ts"], edges: [{ from: "login.ts", to: "a.ts" }] });
      const result = await handleImpactConfirm({ filePath: "a.ts", repoPath: "/repo" });
      expect(result.needsApproval).toBe(true);
      expect(result.affectedFeatures).toContain("Dang nhap");
    });

    it("confirm affects critical basename", async () => {
      vi.mocked(configLoader.loadConfig).mockReturnValue({ severityThresholds: { needsApproval: "high" }, criticalFeatures: ["auth"] });
      vi.mocked(scanner.scanDependencies).mockResolvedValue({ nodes: ["auth.ts", "a.ts"], edges: [{ from: "auth.ts", to: "a.ts" }] });
      const result = await handleImpactConfirm({ filePath: "a.ts", repoPath: "/repo" });
      expect(result.needsApproval).toBe(true);
    });

    it("confirm needs approval by file count", async () => {
      vi.mocked(scanner.scanDependencies).mockResolvedValue({ nodes: ["a.ts", "b.ts", "c.ts", "d.ts"], edges: [{ from: "b.ts", to: "a.ts" }, { from: "c.ts", to: "a.ts" }, { from: "d.ts", to: "a.ts" }] });
      const result = await handleImpactConfirm({ filePath: "a.ts", repoPath: "/repo" });
      expect(result.needsApproval).toBe(true);
    });

    it("confirm downtime for high risk", async () => {
      vi.mocked(scanner.scanDependencies).mockResolvedValue({ nodes: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts", "g.ts"], edges: [{ from: "b.ts", to: "a.ts" }, { from: "c.ts", to: "a.ts" }, { from: "d.ts", to: "a.ts" }, { from: "e.ts", to: "a.ts" }, { from: "f.ts", to: "a.ts" }, { from: "g.ts", to: "a.ts" }] });
      const result = await handleImpactConfirm({ filePath: "a.ts", repoPath: "/repo" });
      expect(result.downtime).toBe("3 days");
    });

    it("confirm downtime for medium risk", async () => {
      vi.mocked(scanner.scanDependencies).mockResolvedValue({ nodes: ["a.ts", "b.ts", "c.ts"], edges: [{ from: "b.ts", to: "a.ts" }, { from: "c.ts", to: "a.ts" }] });
      const result = await handleImpactConfirm({ filePath: "a.ts", repoPath: "/repo" });
      expect(result.downtime).toBe("1 day");
    });

    it("confirm downtime for low risk", async () => {
      vi.mocked(scanner.scanDependencies).mockResolvedValue({ nodes: ["a.ts"], edges: [] });
      const result = await handleImpactConfirm({ filePath: "a.ts", repoPath: "/repo" });
      expect(result.downtime).toBe("30 minutes");
    });

    it("uses scope when provided", async () => {
      const spy = vi.mocked(scanner.scanDependencies);
      await handleImpact({ filePath: "a.ts", repoPath: "/repo", scope: { paths: ["a.ts"] } });
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ paths: ["a.ts"] }));
    });
  });

  describe("bug", () => {
    it("bug report with high severity", async () => {
      const result = await handleBugReport({ description: "user click login and then crash happens", repoPath: "/repo" });
      expect(result.severity).toBe("high");
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it("bug report with medium severity", async () => {
      const result = await handleBugReport({ description: "user cannot access page", repoPath: "/repo" });
      expect(result.severity).toBe("medium");
    });

    it("suggest fix with patternId", async () => {
      const content = 'const x = fetch("url");\n';
      vi.mocked(scanner.getFileContent).mockReturnValue(content);
      const result = await handleSuggestFix({ filePath: "src/app.ts", patternId: "unawaited-fetch", line: 1, repoPath: "/repo" });
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("suggest fix without patternId", async () => {
      const content = 'console.log("debug");\n';
      vi.mocked(scanner.getFileContent).mockReturnValue(content);
      vi.mocked(scanner.getAllSourceFiles).mockReturnValue(["src/app.ts"]);
      const result = await handleSuggestFix({ filePath: "src/app.ts", repoPath: "/repo" });
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("regression with changed files", async () => {
      vi.mocked(scanner.scanDependencies).mockResolvedValue({ nodes: ["a.ts", "b.ts"], edges: [{ from: "b.ts", to: "a.ts" }] });
      const result = await handleBugRegression({ changedFiles: ["a.ts"], repoPath: "/repo" });
      expect(result.testFlows.length).toBeGreaterThan(0);
      expect(result.testFlows[0].files).toContain("b.ts");
    });
  });
});
