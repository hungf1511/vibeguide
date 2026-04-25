import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { handleIndexBuild, handleIndexStatus, handleIndexClear } from "../src/mcp/handlers/indexCommands.js";

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-icmd-"));
  execSync("git init -q", { cwd: dir });
  execSync('git config user.email "t@t.com" && git config user.name "t"', { cwd: dir });
  fs.writeFileSync(path.join(dir, "a.ts"), `export const a = 1;\n`, "utf-8");
  execSync("git add . && git commit -q -m init", { cwd: dir });
  return dir;
}

describe("Index commands", () => {
  let repo: string;

  beforeEach(() => {
    repo = makeRepo();
  });

  afterEach(() => {
    try { fs.rmSync(repo, { recursive: true, force: true }); } catch {}
  });

  it("builds index", async () => {
    const result = await handleIndexBuild({ repoPath: repo });
    expect(result.stats.filesIndexed).toBeGreaterThanOrEqual(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("force rebuild deletes old index", async () => {
    await handleIndexBuild({ repoPath: repo });
    const result = await handleIndexBuild({ repoPath: repo, force: true });
    expect(result.stats.filesIndexed).toBeGreaterThanOrEqual(1);
  });

  it("status reports no index when missing", async () => {
    const result = await handleIndexStatus({ repoPath: repo });
    expect(result.exists).toBe(false);
    expect(result.files).toBe(0);
    expect(result.isFresh).toBe(false);
  });

  it("status reports fresh index", async () => {
    await handleIndexBuild({ repoPath: repo });
    const result = await handleIndexStatus({ repoPath: repo });
    expect(result.exists).toBe(true);
    expect(result.files).toBeGreaterThanOrEqual(1);
    expect(result.isFresh).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.lastBuildAt).toBeDefined();
  });

  it("clear removes index", async () => {
    await handleIndexBuild({ repoPath: repo });
    const result = await handleIndexClear({ repoPath: repo });
    expect(result.removed).toBe(true);
    const dbPath = path.join(repo, ".vibeguide", "index.db");
    expect(fs.existsSync(dbPath)).toBe(false);
  });

  it("clear no-op when index missing", async () => {
    const result = await handleIndexClear({ repoPath: repo });
    expect(result.removed).toBe(false);
  });
});
