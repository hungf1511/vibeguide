import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { getBlame, getCacheSignature, getDiff, getDiffStat, getLog, getLogWithFiles, lsFiles } from "../src/core/git/index.js";

let repo: string;

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf-8" });
}

function write(rel: string, content: string): void {
  const full = path.join(repo, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
}

function commit(message: string): void {
  git(["add", "."]);
  git(["commit", "-m", message]);
}

describe("git core", () => {
  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "vibeguide-git-"));
    git(["init"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "VibeGuide Test"]);
    write("src/index.ts", "export const value = 1;\n");
    write("coverage/sorter.js", "node.innerHTML = '<span></span>';\n");
    commit("initial commit");
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("parses git log without synthetic --format commits", () => {
    const commits = getLog(repo, 1);
    expect(commits).toHaveLength(1);
    expect(commits[0].sha).toMatch(/^[0-9a-f]{40}$/);
    expect(commits[0].sha).not.toBe("--format=");
    expect(commits[0].message).toBe("initial commit");
  });

  it("returns changed files with each commit", () => {
    const commits = getLogWithFiles(repo, 1);
    expect(commits).toHaveLength(1);
    expect(commits[0].files.map((f) => f.changedFile)).toContain("src/index.ts");
  });

  it("ignores generated coverage files even when they are tracked", () => {
    expect(lsFiles(repo)).toEqual(["src/index.ts"]);
  });

  it("changes cache signature when dirty file content changes", () => {
    const clean = getCacheSignature(repo);
    write("src/index.ts", "export const value = 2;\n");
    const dirtyA = getCacheSignature(repo);
    write("src/index.ts", "export const value = 3;\n");
    const dirtyB = getCacheSignature(repo);
    expect(dirtyA).not.toBe(clean);
    expect(dirtyB).not.toBe(dirtyA);
  });

  it("returns empty git data for non-git directories", () => {
    const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), "vibeguide-non-git-"));
    try {
      fs.writeFileSync(path.join(nonGit, "plain.ts"), "export const plain = true;\n", "utf-8");
      expect(getLog(nonGit)).toEqual([]);
      expect(getLogWithFiles(nonGit)).toEqual([]);
      expect(getDiff(nonGit)).toEqual([]);
      expect(getDiffStat(nonGit)).toEqual([]);
      expect(getBlame(nonGit, "plain.ts")).toEqual([]);
      expect(lsFiles(nonGit)).toEqual(["plain.ts"]);
    } finally {
      fs.rmSync(nonGit, { recursive: true, force: true });
    }
  });
});
