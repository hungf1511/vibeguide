import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/utils/scanner.js", async () => {
  const actual = await vi.importActual("../src/utils/scanner.js");
  return {
    ...actual,
    getRepoSignature: vi.fn(() => "sig"),
    scanDependencies: vi.fn(async () => ({ nodes: [], edges: [] })),
  };
});

vi.mock("../src/utils/pathGuard.js", () => ({
  resolveRepo: vi.fn((p) => p || "/repo"),
}));

vi.mock("../src/utils/qualityChecks.js", () => ({
  runTypeCheck: vi.fn(() => ({ passed: true, errorCount: 0, summary: "ok" })),
}));

vi.mock("../src/utils/codeAnalysis.js", () => ({
  findCircularDeps: vi.fn(() => ({ cycles: [] })),
  scanSecrets: vi.fn(() => ({ findings: [], summary: "ok", scannedFiles: 1 })),
}));

vi.mock("../src/mcp/handlers/bug.js", () => ({
  handleHeuristicBug: vi.fn(async () => ({ matches: [], totalMatches: 0, summary: "ok" })),
  handleTestPlan: vi.fn(async () => ({ steps: [], expect: [] })),
}));

vi.mock("../src/mcp/handlers/impact.js", () => ({
  handleImpact: vi.fn(async () => ({ risk: "low", affectedFiles: [], indirectFiles: [] })),
}));

vi.mock("../src/mcp/handlers/snapshotDiff.js", () => ({
  handleDiffSummary: vi.fn(async () => ({ summary: "ok", filesChanged: [], riskAssessment: "low", totalFiles: 0 })),
}));

import { handleReviewPr } from "../src/mcp/handlers/review.js";
import * as qualityChecks from "../src/utils/qualityChecks.js";
import * as codeAnalysis from "../src/utils/codeAnalysis.js";
import * as bugHandlers from "../src/mcp/handlers/bug.js";
import * as impactHandlers from "../src/mcp/handlers/impact.js";
import * as snapshotDiff from "../src/mcp/handlers/snapshotDiff.js";

describe("review branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reviews with filePath and feature", async () => {
    const result = await handleReviewPr({ repoPath: "/repo", filePath: "src/a.ts", feature: "auth" });
    expect(result.sections.some((s) => s.name.includes("Impact"))).toBe(true);
    expect(result.sections.some((s) => s.name.includes("Test plan"))).toBe(true);
  });

  it("typeScript check with errors", async () => {
    vi.mocked(qualityChecks.runTypeCheck).mockReturnValue({ passed: false, errorCount: 3, summary: "3 errors" });
    const result = await handleReviewPr({ repoPath: "/repo" });
    const tsSection = result.sections.find((s) => s.name === "TypeScript");
    expect(tsSection?.status).toBe("block");
    expect(result.blockers.some((b) => b.includes("TypeScript"))).toBe(true);
  });

  it("typeScript compiler unavailable", async () => {
    vi.mocked(qualityChecks.runTypeCheck).mockReturnValue({ passed: false, errorCount: 0, summary: "unavailable" });
    const result = await handleReviewPr({ repoPath: "/repo" });
    const tsSection = result.sections.find((s) => s.name === "TypeScript");
    expect(tsSection?.status).toBe("warn");
    expect(result.warnings.some((w) => w.includes("TypeScript"))).toBe(true);
  });

  it("bug patterns critical", async () => {
    vi.mocked(bugHandlers.handleHeuristicBug).mockResolvedValue({ matches: [{ score: 1.0 }], totalMatches: 6, summary: "bugs" });
    const result = await handleReviewPr({ repoPath: "/repo" });
    const bugSection = result.sections.find((s) => s.name === "Bug patterns");
    expect(bugSection?.status).toBe("block");
    expect(result.blockers.some((b) => b.includes("Bug"))).toBe(true);
  });

  it("bug patterns warning", async () => {
    vi.mocked(bugHandlers.handleHeuristicBug).mockResolvedValue({ matches: [], totalMatches: 6, summary: "bugs" });
    const result = await handleReviewPr({ repoPath: "/repo" });
    const bugSection = result.sections.find((s) => s.name === "Bug patterns");
    expect(bugSection?.status).toBe("warn");
    expect(result.warnings.some((w) => w.includes("Bug"))).toBe(true);
  });

  it("bug patterns throws", async () => {
    vi.mocked(bugHandlers.handleHeuristicBug).mockRejectedValue(new Error("fail"));
    const result = await handleReviewPr({ repoPath: "/repo" });
    const bugSection = result.sections.find((s) => s.name === "Bug patterns");
    expect(bugSection?.status).toBe("warn");
    expect(result.warnings.some((w) => w.includes("Bug"))).toBe(true);
  });

  it("secrets critical", async () => {
    vi.mocked(codeAnalysis.scanSecrets).mockReturnValue({ findings: [{ severity: "critical" }], summary: "1 secret", scannedFiles: 1 });
    const result = await handleReviewPr({ repoPath: "/repo" });
    const secSection = result.sections.find((s) => s.name === "Secret scan");
    expect(secSection?.status).toBe("block");
    expect(result.blockers.some((b) => b.includes("Secret"))).toBe(true);
  });

  it("circular deps found", async () => {
    vi.mocked(codeAnalysis.findCircularDeps).mockResolvedValue({ cycles: [["a.ts", "b.ts"]], cycleCount: 1, summary: "1 cycle" });
    const result = await handleReviewPr({ repoPath: "/repo" });
    const circSection = result.sections.find((s) => s.name === "Circular deps");
    expect(circSection?.status).toBe("warn");
    expect(result.warnings.some((w) => w.includes("Circular"))).toBe(true);
  });

  it("diff with many files warns", async () => {
    vi.mocked(snapshotDiff.handleDiffSummary).mockResolvedValue({ summary: "many", filesChanged: Array.from({ length: 25 }, (_, i) => `f${i}.ts`), riskAssessment: "medium", totalFiles: 25 });
    const result = await handleReviewPr({ repoPath: "/repo" });
    const diffSection = result.sections.find((s) => s.name === "Changes");
    expect(diffSection?.status).toBe("warn");
  });

  it("diff throws", async () => {
    vi.mocked(snapshotDiff.handleDiffSummary).mockRejectedValue(new Error("diff fail"));
    const result = await handleReviewPr({ repoPath: "/repo" });
    const diffSection = result.sections.find((s) => s.name === "Changes");
    expect(diffSection?.status).toBe("warn");
    expect(result.warnings.some((w) => w.includes("diff failed"))).toBe(true);
  });

  it("impact high risk warns", async () => {
    vi.mocked(impactHandlers.handleImpact).mockResolvedValue({ risk: "high", affectedFiles: ["a.ts"], indirectFiles: ["b.ts"] });
    const result = await handleReviewPr({ repoPath: "/repo", filePath: "src/a.ts" });
    const impactSection = result.sections.find((s) => s.name.includes("Impact"));
    expect(impactSection?.status).toBe("warn");
  });

  it("impact throws", async () => {
    vi.mocked(impactHandlers.handleImpact).mockRejectedValue(new Error("impact fail"));
    const result = await handleReviewPr({ repoPath: "/repo", filePath: "src/a.ts" });
    const impactSection = result.sections.find((s) => s.name.includes("Impact"));
    expect(impactSection?.status).toBe("warn");
    expect(result.warnings.some((w) => w.includes("Impact"))).toBe(true);
  });

  it("feature throws", async () => {
    vi.mocked(bugHandlers.handleTestPlan).mockRejectedValue(new Error("plan fail"));
    const result = await handleReviewPr({ repoPath: "/repo", feature: "auth" });
    const planSection = result.sections.find((s) => s.name.includes("Test plan"));
    expect(planSection?.status).toBe("warn");
    expect(result.warnings.some((w) => w.includes("Test plan"))).toBe(true);
  });
});
