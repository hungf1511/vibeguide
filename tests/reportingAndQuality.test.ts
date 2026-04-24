import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { getBlame, getDiff, getDiffStat } from "../src/core/git/index.js";
import {
  handleExportReport,
  handleFounderBrief,
  handleI18nGap,
  handleMeetingNotes,
  handleReviewPr,
  handleSessionStatus,
  handleSmartRoute,
  handleTestCoverage,
  handleTypeCheck,
  handleDocGap,
} from "../src/mcp/handlers/index.js";
import { handleToolCall } from "../src/mcp/tools.js";
import { compressOutput } from "../src/mcp/toolOutput.js";
import { getTestCoverage } from "../src/utils/testCoverage.js";
import { findI18nGap } from "../src/utils/i18nGap.js";
import { findDocGaps } from "../src/utils/docGap.js";
import { exportReport } from "../src/utils/reportExporter.js";
import type { SessionContext } from "../src/utils/sessionContext.js";

let repo: string;

function write(rel: string, content: string): void {
  const full = path.join(repo, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf-8" });
}

describe("reporting and quality tools", () => {
  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "vibeguide-quality-"));
    git(["init"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "VibeGuide Test"]);
    write("src/index.ts", "/** file doc */\nexport function greet(name: string) { return `hi ${name}`; }\n");
    git(["add", "."]);
    git(["commit", "-m", "initial"]);
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("reads coverage summary and lcov reports", async () => {
    expect(getTestCoverage(repo).found).toBe(false);

    write("coverage/coverage-summary.json", JSON.stringify({
      total: {
        lines: { pct: 80 },
        branches: { pct: 70 },
        functions: { pct: 90 },
        statements: { pct: 82 },
      },
      "src/index.ts": { lines: { pct: 80 } },
      "src/weak.ts": { lines: { pct: 20 } },
    }));
    const summary = getTestCoverage(repo);
    expect(summary.found).toBe(true);
    expect(summary.weakFiles[0].file).toBe("src/weak.ts");
    expect((await handleTestCoverage({ repoPath: repo })).source).toBe("coverage-summary.json");

    fs.rmSync(path.join(repo, "coverage", "coverage-summary.json"));
    write("coverage/lcov.info", "SF:" + path.join(repo, "src/index.ts") + "\nLF:10\nLH:8\nend_of_record\n");
    expect(getTestCoverage(repo).source).toBe("lcov.info");
  });

  it("detects i18n and doc gaps in fixture repos", async () => {
    write("locales/en.json", JSON.stringify({ common: { save: "Save", cancel: "Cancel" } }));
    write("locales/vi.json", JSON.stringify({ common: { save: "Luu" }, extra: "Them" }));
    write("src/undocumented.ts", "export const undocumented = 1;\n");
    const gap = findI18nGap(repo, "en");
    expect(gap.locales[0].missingKeys).toContain("common.cancel");
    expect((await handleI18nGap({ repoPath: repo, baseLocale: "en" })).summary).toContain("key thieu");
    expect(findI18nGap(repo, "fr").summary).toContain("Khong co locale base");

    const docs = findDocGaps(repo);
    expect(docs.exportsMissingJsdoc.length).toBeGreaterThan(0);
    expect((await handleDocGap({ repoPath: repo })).summary).toContain("export");
  });

  it("covers git diff and blame helpers", () => {
    write("src/index.ts", "/** file doc */\nexport function greet(name: string) { return `hello ${name}`; }\n");
    expect(getDiff(repo).map((d) => d.file)).toContain("src/index.ts");
    expect(getDiffStat(repo)[0].addedLines).toBeGreaterThanOrEqual(0);
    const blame = getBlame(repo, "src/index.ts");
    expect(blame.length).toBeGreaterThan(0);
    expect(blame[0].author).toBe("VibeGuide Test");
  });

  it("runs session, briefing, review, and compression paths", async () => {
    const root = path.resolve(".");
    const smart = await handleSmartRoute({ repoPath: root, situation: "deploy bi loi va can review PR" });
    expect(smart.vibeGuideTools.length).toBeGreaterThan(0);

    const session = await handleSessionStatus({ repoPath: root });
    expect(session.timeline.length).toBeGreaterThan(0);

    const report = await handleExportReport({ repoPath: root, format: "text" });
    expect(report.report).toContain("BÁO CÁO");

    const founder = await handleFounderBrief({ repoPath: root, days: 7 });
    expect(founder.brief).toContain("Báo cáo tuần");

    const notes = await handleMeetingNotes({ repoPath: root });
    expect(notes.notes).toContain("Biên bản họp");

    const review = await handleReviewPr({ repoPath: root, filePath: "src/core/git/log.ts", feature: "P0/P1 fix" });
    expect(review.sections.length).toBeGreaterThan(0);

    const typeCheck = await handleTypeCheck({ repoPath: root });
    expect(typeCheck.passed).toBe(true);

    const large = compressOutput({ items: Array.from({ length: 20 }, (_, i) => ({ i })) }, 200);
    expect(large).toContain("itemsTotal");
    expect(compressOutput("x".repeat(300), 20)).toContain("truncated");
    expect(compressOutput({ nested: Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i])) }, 5000)).toContain("nestedKeys");

    const toolResult = await handleToolCall("vibeguide_scan_repo", { repoPath: root, scope: { paths: ["src/core/git"] } });
    expect(toolResult.content[0].text).toContain("src/core/git");
    await expect(handleToolCall("missing_tool", {})).rejects.toThrow("Unknown tool");
    await expect(handleToolCall("vibeguide_get_file", { repoPath: root })).rejects.toThrow("Invalid arguments");
  }, 30000);

  it("exports session reports in all formats", () => {
    const ctx: SessionContext = {
      repo,
      startedAt: "2026-04-24T00:00:00.000Z",
      currentSituation: "testing",
      status: "testing",
      snapshotId: "snap-1",
      filesChanged: ["src/index.ts"],
      testResults: [{ step: 1, passed: true, note: "ok" }],
      events: [{ timestamp: "2026-04-24T00:00:00.000Z", tool: "vibeguide_test_plan", input: {}, output: {} }],
      founderDecisions: [{ type: "approve", note: "ship", timestamp: "2026-04-24T00:00:00.000Z" }],
    };
    expect(exportReport(ctx, "markdown")).toContain("# Báo cáo");
    expect(exportReport(ctx, "json")).toContain("\"repo\"");
    expect(exportReport(ctx, "text")).toContain("QUYẾT ĐỊNH");
  });
});
