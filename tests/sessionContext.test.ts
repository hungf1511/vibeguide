import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getSession,
  logEvent,
  getTimeline,
  generateProgressSummary,
} from "../src/utils/sessionContext.js";

function sessionDir(): string {
  return path.join(os.homedir(), ".vibeguide", "session");
}

function cleanup() {
  try {
    fs.rmSync(sessionDir(), { recursive: true, force: true });
  } catch {}
}

beforeEach(() => cleanup());
afterEach(() => cleanup());

describe("sessionContext branches", () => {
  it("creates new session when file missing", () => {
    cleanup();
    const s = getSession("/repo/a");
    expect(s.status).toBe("idle");
    expect(s.events).toEqual([]);
  });

  it("reads existing session file", () => {
    const key = path.join(sessionDir(), "_repo_b.json");
    fs.mkdirSync(path.dirname(key), { recursive: true });
    fs.writeFileSync(key, JSON.stringify({ repo: "/repo/b", status: "fixing", filesChanged: [], testResults: [], events: [], founderDecisions: [], startedAt: "2024-01-01T00:00:00Z" }), "utf-8");
    const s = getSession("/repo/b");
    expect(s.status).toBe("fixing");
  });

  it("falls back on corrupted JSON", () => {
    const key = path.join(sessionDir(), "_repo_c.json");
    fs.mkdirSync(path.dirname(key), { recursive: true });
    fs.writeFileSync(key, "bad json", "utf-8");
    const s = getSession("/repo/c");
    expect(s.status).toBe("idle");
  });

  it("logEvent sets analyzing for impact", () => {
    logEvent("/repo/d", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_impact", input: {}, output: {} });
    expect(getSession("/repo/d").status).toBe("analyzing");
  });

  it("logEvent sets fixing for suggest_fix", () => {
    logEvent("/repo/e", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_suggest_fix", input: {}, output: {} });
    expect(getSession("/repo/e").status).toBe("fixing");
  });

  it("logEvent sets testing for test_plan", () => {
    logEvent("/repo/f", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_test_plan", input: {}, output: {} });
    expect(getSession("/repo/f").status).toBe("testing");
  });

  it("logEvent sets deploying for deploy_check", () => {
    logEvent("/repo/g", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_deploy_check", input: {}, output: {} });
    expect(getSession("/repo/g").status).toBe("deploying");
  });

  it("logEvent keeps idle for unknown tool", () => {
    logEvent("/repo/h", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_other", input: {}, output: {} });
    expect(getSession("/repo/h").status).toBe("idle");
  });

  it("logEvent sets snapshotId when present", () => {
    logEvent("/repo/i", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_snapshot", input: {}, output: { snapshotId: "snap-1" } });
    expect(getSession("/repo/i").snapshotId).toBe("snap-1");
  });

  it("logEvent does not set snapshotId when absent", () => {
    logEvent("/repo/j", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_snapshot", input: {}, output: {} });
    expect(getSession("/repo/j").snapshotId).toBeUndefined();
  });

  it("getTimeline includes currentSituation", () => {
    const ctx = getSession("/repo/k");
    ctx.currentSituation = "bug";
    expect(getTimeline(ctx).some((l) => l.includes("bug"))).toBe(true);
  });

  it("getTimeline includes snapshotId", () => {
    const ctx = getSession("/repo/l");
    ctx.snapshotId = "snap-2";
    expect(getTimeline(ctx).some((l) => l.includes("snap-2"))).toBe(true);
  });

  it("getTimeline includes filesChanged", () => {
    const ctx = getSession("/repo/m");
    ctx.filesChanged = ["a.ts"];
    expect(getTimeline(ctx).some((l) => l.includes("a.ts"))).toBe(true);
  });

  it("getTimeline slices to last 10 events", () => {
    const ctx = getSession("/repo/n");
    ctx.events = Array.from({ length: 15 }, (_, i) => ({ timestamp: "2024-01-01T00:00:00Z", tool: "tool-" + i, input: {}, output: {} }));
    expect(getTimeline(ctx).filter((l) => l.includes("tool-")).length).toBeLessThanOrEqual(10);
  });

  it("getTimeline shows founder decision", () => {
    const ctx = getSession("/repo/o");
    ctx.founderDecisions = [{ type: "approve", note: "ok", timestamp: "2024-01-01T00:00:00Z" }];
    expect(getTimeline(ctx).some((l) => l.includes("approve"))).toBe(true);
  });

  it("generateProgressSummary with changed files", () => {
    const ctx = getSession("/repo/p");
    ctx.filesChanged = ["a.ts", "b.ts", "c.ts", "d.ts"];
    expect(generateProgressSummary(ctx)).toContain("a.ts");
  });

  it("generateProgressSummary with snapshot", () => {
    const ctx = getSession("/repo/q");
    ctx.snapshotId = "snap-3";
    expect(generateProgressSummary(ctx)).toContain("snap-3");
  });

  it("generateProgressSummary with test results", () => {
    const ctx = getSession("/repo/r");
    ctx.testResults = [{ step: 1, passed: true, note: "ok" }];
    expect(generateProgressSummary(ctx)).toContain("1/1");
  });

  it("generateProgressSummary with lastAction impact", () => {
    const ctx = getSession("/repo/s");
    ctx.lastAction = "vibeguide_impact";
    expect(generateProgressSummary(ctx).length).toBeGreaterThan(0);
  });

  it("generateProgressSummary with lastAction bug", () => {
    const ctx = getSession("/repo/t");
    ctx.lastAction = "vibeguide_bug";
    expect(generateProgressSummary(ctx).length).toBeGreaterThan(0);
  });

  it("generateProgressSummary with lastAction fix", () => {
    const ctx = getSession("/repo/u");
    ctx.lastAction = "vibeguide_suggest_fix";
    expect(generateProgressSummary(ctx).length).toBeGreaterThan(0);
  });

  it("generateProgressSummary with lastAction test", () => {
    const ctx = getSession("/repo/v");
    ctx.lastAction = "vibeguide_test_plan";
    expect(generateProgressSummary(ctx).length).toBeGreaterThan(0);
  });

  it("generateProgressSummary with lastAction deploy", () => {
    const ctx = getSession("/repo/w");
    ctx.lastAction = "vibeguide_deploy_check";
    expect(generateProgressSummary(ctx).length).toBeGreaterThan(0);
  });

  it("generateProgressSummary with lastAction snapshot", () => {
    const ctx = getSession("/repo/x");
    ctx.lastAction = "vibeguide_snapshot";
    expect(generateProgressSummary(ctx)).toContain("snapshot");
  });

  it("generateProgressSummary ignores unknown action", () => {
    const ctx = getSession("/repo/y");
    ctx.lastAction = "vibeguide_unknown";
    expect(generateProgressSummary(ctx)).not.toContain("vibeguide_unknown");
  });

  it("generateProgressSummary with approve decision", () => {
    const ctx = getSession("/repo/z1");
    ctx.founderDecisions = [{ type: "approve", note: "ok", timestamp: "2024-01-01T00:00:00Z" }];
    expect(generateProgressSummary(ctx)).toContain("ok");
  });

  it("generateProgressSummary with reject decision", () => {
    const ctx = getSession("/repo/z2");
    ctx.founderDecisions = [{ type: "reject", note: "no", timestamp: "2024-01-01T00:00:00Z" }];
    expect(generateProgressSummary(ctx)).toContain("no");
  });

  it("generateProgressSummary with rollback decision", () => {
    const ctx = getSession("/repo/z3");
    ctx.founderDecisions = [{ type: "rollback", note: "revert", timestamp: "2024-01-01T00:00:00Z" }];
    expect(generateProgressSummary(ctx)).toContain("revert");
  });


  it("logEvent summarize scan", () => {
    logEvent("/repo/scan", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_scan", input: {}, output: { stats: { totalFiles: 5 } } });
    expect(getSession("/repo/scan").events[0].output.stats.totalFiles).toBe(5);
  });

  it("logEvent summarize bug", () => {
    logEvent("/repo/bug", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_bug", input: {}, output: { matches: [1, 2] } });
    expect(getSession("/repo/bug").events[0].output.matches.length).toBe(2);
  });


  it("logEvent summarize deploy", () => {
    logEvent("/repo/deploy", { timestamp: "2024-01-01T00:00:00Z", tool: "vibeguide_deploy_check", input: {}, output: { summary: "ready" } });
    expect(getSession("/repo/deploy").events[0].output.summary).toBe("ready");
  });
});
