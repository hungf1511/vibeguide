import { describe, it, expect, vi, beforeEach } from "vitest";
import * as scanner from "../src/utils/scanner.js";
import { handleSmartRoute, handleSessionStatus, handleExportReport } from "../src/mcp/handlers/session.js";
import { getTestCoverage } from "../src/utils/testCoverage.js";
import { loadConfig, detectFramework } from "../src/utils/configLoader.js";
import { findCircularDeps } from "../src/utils/circularDeps.js";
import { analyzeComplexity } from "../src/utils/complexity.js";
import { analyzeMonorepo } from "../src/utils/monorepo.js";
import * as pathGuard from "../src/utils/pathGuard.js";
import * as sessionContext from "../src/utils/sessionContext.js";
import * as reportExporter from "../src/utils/reportExporter.js";
import * as configLoader from "../src/utils/configLoader.js";
import * as pluginDiscovery from "../src/utils/pluginDiscovery.js";
import * as fs2 from "fs";

vi.mock("../src/utils/scanner.js", async () => {
  const actual = await vi.importActual("../src/utils/scanner.js");
  return {
    ...actual,
    getAllSourceFiles: vi.fn(() => ["src/app.ts"]),
    normalizePath: vi.fn((p: string) => p.replace(/\\/g, "/")),
    scanDependencies: vi.fn(async () => ({ nodes: ["a.ts", "b.ts"], edges: [{ from: "a.ts", to: "b.ts" }, { from: "b.ts", to: "a.ts" }] })),
  };
});

vi.mock("../src/utils/pathGuard.js", () => ({
  resolveRepo: vi.fn((p?: string) => p || "/repo"),
}));

vi.mock("../src/utils/sessionContext.js", () => ({
  getSession: vi.fn(() => ({ repo: "/repo", status: "idle", filesChanged: [], testResults: [], events: [], founderDecisions: [], startedAt: "" })),
  getTimeline: vi.fn(() => []),
  generateProgressSummary: vi.fn(() => "summary"),
}));

vi.mock("../src/utils/reportExporter.js", () => ({
  exportReport: vi.fn(() => "report"),
  saveReport: vi.fn(() => "/tmp/report.md"),
}));

vi.mock("../src/utils/pluginDiscovery.js", () => ({
  discoverInstalledPlugins: vi.fn(() => []),
  recommendPluginsForSituation: vi.fn(() => ({ plugins: [], tools: [], detectedType: "general" })),
}));

vi.mock("../src/utils/codeText.js", () => ({
  stripNonCode: vi.fn((c: string) => c),
}));

describe("remaining coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("session handlers", () => {
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = fs2.mkdtempSync("/tmp/sess-");
    });
    afterEach(() => {
      fs2.rmSync(tmpDir, { recursive: true, force: true });
    });
    it("smart route with plugins and tools", async () => {
      vi.mocked(pluginDiscovery.discoverInstalledPlugins).mockReturnValue([{ name: "p1", confidence: 0.8 } as any]);
      vi.mocked(pluginDiscovery.recommendPluginsForSituation).mockReturnValue({ plugins: [{ name: "p1", confidence: 0.8, reason: "r1" }], tools: [{ name: "t1", confidence: 0.9, reason: "r2" }], detectedType: "bug" });
      const result = await handleSmartRoute({ situation: "bug", repoPath: "/repo" });
      expect(result.recommendedPlugins.length).toBeGreaterThan(0);
      expect(result.vibeGuideTools.length).toBeGreaterThan(0);
    });

    it("smart route empty", async () => {
      vi.mocked(pluginDiscovery.recommendPluginsForSituation).mockReturnValue({ plugins: [], tools: [], detectedType: "general" });
      const result = await handleSmartRoute({ situation: "x", repoPath: "/repo" });
      expect(result.summary).toContain("Khong tim thay");
    });

    it("export report with saveToFile", async () => {
      fs2.writeFileSync(tmpDir + "/.vibeguide.json", JSON.stringify({ outputFormat: "markdown" }), "utf-8");
      const result = await handleExportReport({ repoPath: tmpDir, saveToFile: true });
      expect(result.filePath).toBeDefined();
    });

    it("export report json format", async () => {
      fs2.writeFileSync(tmpDir + "/.vibeguide.json", JSON.stringify({ outputFormat: "text" }), "utf-8");
      const result = await handleExportReport({ repoPath: tmpDir, format: "json" });
      expect(result.format).toBe("json");
    });
  });

  describe("testCoverage", () => {
    const tmpDir = "/tmp/cov-repo";
    beforeEach(() => {
      try { fs2.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      fs2.mkdirSync(tmpDir, { recursive: true });
    });

    it("reads coverage summary with weak files", () => {
      fs2.mkdirSync(tmpDir + "/coverage", { recursive: true });
      fs2.writeFileSync(tmpDir + "/coverage/coverage-summary.json", JSON.stringify({ total: { lines: { pct: 90 }, branches: { pct: 80 }, functions: { pct: 85 }, statements: { pct: 88 } }, "src/a.ts": { lines: { pct: 30 } } }), "utf-8");
      const result = getTestCoverage(tmpDir);
      expect(result.found).toBe(true);
      expect(result.weakFiles.length).toBeGreaterThan(0);
    });

    it("reads lcov info", () => {
      fs2.mkdirSync(tmpDir + "/coverage", { recursive: true });
      fs2.writeFileSync(tmpDir + "/coverage/lcov.info", "SF:src/a.ts\nLF:10\nLH:3\nend_of_record", "utf-8");
      const result = getTestCoverage(tmpDir);
      expect(result.found).toBe(true);
      expect(result.source).toBe("lcov.info");
    });

    it("returns not found when no coverage", () => {
      fs2.rmSync(tmpDir + "/coverage", { recursive: true, force: true });
      const result = getTestCoverage(tmpDir);
      expect(result.found).toBe(false);
    });
  });

  describe("circularDeps", () => {
    it("finds cycles", async () => {
      const result = await findCircularDeps("/repo");
      expect(result.cycleCount).toBeGreaterThan(0);
    });
  });

  describe("complexity", () => {
    it("flags high complexity file", () => {
      const dir = fs2.mkdtempSync("/tmp/cpx-");
      fs2.mkdirSync(dir + "/src", { recursive: true });
      const content = "function a() { if (x) { for (;;) { while (y) { switch (z) { case 1: break; } } } } }\n" +
                       "function b() { if (x) { for (;;) { while (y) { switch (z) { case 1: break; } } } } }\n";
      fs2.writeFileSync(dir + "/src/app.ts", content, "utf-8");
      const result = analyzeComplexity(dir, { thresholdLoc: 1, thresholdComplexity: 1 });
      expect(result.files.some((f) => f.flagged)).toBe(true);
      fs2.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe("monorepo", () => {
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = fs2.mkdtempSync("/tmp/mono-");
    });
    afterEach(() => {
      fs2.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("detects pnpm workspace", () => {
      fs2.writeFileSync(tmpDir + "/pnpm-workspace.yaml", "packages:\n  - apps/*", "utf-8");
      fs2.mkdirSync(tmpDir + "/apps/web", { recursive: true });
      fs2.writeFileSync(tmpDir + "/apps/web/package.json", JSON.stringify({ name: "web" }), "utf-8");
      const result = analyzeMonorepo(tmpDir, []);
      expect(result.isMonorepo).toBe(true);
      expect(result.manager).toBe("pnpm");
    });

    it("detects nx workspace", () => {
      fs2.writeFileSync(tmpDir + "/nx.json", "{}", "utf-8");
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ name: "root" }), "utf-8");
      const result = analyzeMonorepo(tmpDir, []);
      expect(result.isMonorepo).toBe(true);
      expect(result.manager).toBe("nx");
    });

    it("detects turbo without package.json", () => {
      fs2.writeFileSync(tmpDir + "/turbo.json", "{}", "utf-8");
      const result = analyzeMonorepo(tmpDir, []);
      expect(result.isMonorepo).toBe(true);
      expect(result.manager).toBe("turbo");
    });

    it("detects turbo workspace", () => {
      fs2.writeFileSync(tmpDir + "/turbo.json", "{}", "utf-8");
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ name: "root", workspaces: { packages: ["apps/*"] } }), "utf-8");
      fs2.mkdirSync(tmpDir + "/apps/api", { recursive: true });
      fs2.writeFileSync(tmpDir + "/apps/api/package.json", JSON.stringify({ name: "api" }), "utf-8");
      const result = analyzeMonorepo(tmpDir, []);
      expect(result.isMonorepo).toBe(true);
      expect(result.manager).toBe("turbo");
    });

    it("detects lerna workspace", () => {
      fs2.writeFileSync(tmpDir + "/lerna.json", JSON.stringify({ packages: ["packages/*"] }), "utf-8");
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ name: "root" }), "utf-8");
      fs2.mkdirSync(tmpDir + "/packages/lib", { recursive: true });
      fs2.writeFileSync(tmpDir + "/packages/lib/package.json", JSON.stringify({ name: "lib" }), "utf-8");
      const result = analyzeMonorepo(tmpDir, []);
      expect(result.isMonorepo).toBe(true);
      expect(result.manager).toBe("lerna");
    });

    it("detects yarn workspace", () => {
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ name: "root", workspaces: ["packages/*"] }), "utf-8");
      fs2.mkdirSync(tmpDir + "/packages/core", { recursive: true });
      fs2.writeFileSync(tmpDir + "/packages/core/package.json", JSON.stringify({ name: "core" }), "utf-8");
      const result = analyzeMonorepo(tmpDir, []);
      expect(result.isMonorepo).toBe(true);
      expect(result.manager).toBe("yarn-workspaces");
    });



    it("detects yarn workspace skipping empty dir", () => {
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ name: "root", workspaces: ["packages/*"] }), "utf-8");
      fs2.mkdirSync(tmpDir + "/packages/core", { recursive: true });
      fs2.writeFileSync(tmpDir + "/packages/core/package.json", JSON.stringify({ name: "core" }), "utf-8");
      fs2.mkdirSync(tmpDir + "/packages/empty", { recursive: true });
      const result = analyzeMonorepo(tmpDir, []);
      expect(result.isMonorepo).toBe(true);
      expect(result.packages.length).toBe(1);
    });
    it("returns non-monorepo", () => {
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ name: "root" }), "utf-8");
      const result = analyzeMonorepo(tmpDir, []);
      expect(result.isMonorepo).toBe(false);
    });
  });
});

  describe("configLoader", () => {
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = fs2.mkdtempSync("/tmp/cfg-");
    });
    afterEach(() => {
      fs2.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("loads user config", () => {
      
      fs2.writeFileSync(tmpDir + "/.vibeguide.json", JSON.stringify({ framework: "react", language: "en" }), "utf-8");
      const cfg = loadConfig(tmpDir);
      expect(cfg.framework).toBe("react");
      expect(cfg.language).toBe("en");
    });

    it("detects nextjs", () => {
      
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ dependencies: { next: "1" } }), "utf-8");
      expect(detectFramework(tmpDir)).toBe("nextjs");
    });

    it("detects remix", () => {
      
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ dependencies: { "@remix-run/react": "1" } }), "utf-8");
      expect(detectFramework(tmpDir)).toBe("remix");
    });

    it("detects nuxt", () => {
      
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ dependencies: { nuxt: "1" } }), "utf-8");
      expect(detectFramework(tmpDir)).toBe("nuxt");
    });

    it("detects react", () => {
      
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ dependencies: { react: "1" } }), "utf-8");
      expect(detectFramework(tmpDir)).toBe("react");
    });

    it("detects vue via nuxt branch", () => {
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ dependencies: { vue: "1" } }), "utf-8");
      expect(detectFramework(tmpDir)).toBe("nuxt");
    });

    it("falls back to generic", () => {
      
      fs2.writeFileSync(tmpDir + "/package.json", JSON.stringify({ dependencies: {} }), "utf-8");
      expect(detectFramework(tmpDir)).toBe("generic");
    });

    it("falls back when no package.json", () => {
      
      expect(detectFramework(tmpDir)).toBe("generic");
    });
  });

