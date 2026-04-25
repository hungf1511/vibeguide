import { describe, it, expect, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { getHead, getCacheSignature } from "../src/core/git/head.js";

describe("coreGit head branches", () => {
  let tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
    }
    tmpDirs = [];
  });

  function makeGitRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-git-"));
    tmpDirs.push(dir);
    execSync("git init -q", { cwd: dir });
    execSync("git config user.email t@t.com && git config user.name t", { cwd: dir });
    fs.writeFileSync(path.join(dir, "f.txt"), "x");
    execSync("git add . && git commit -q -m init", { cwd: dir });
    return dir;
  }

  it("returns HEAD info", () => {
    const dir = makeGitRepo();
    const head = getHead(dir);
    expect(head.branch).toMatch(/main|master/);
    expect(head.sha.length).toBe(40);
    expect(head.isClean).toBe(true);
  });

  it("detects detached HEAD", () => {
    const dir = makeGitRepo();
    const sha = execSync("git rev-parse HEAD", { cwd: dir, encoding: "utf-8" }).trim();
    execSync("git checkout -q --detach " + sha, { cwd: dir });
    const head = getHead(dir);
    expect(head.branch).toBe("detached");
  });

  it("counts dirty files", () => {
    const dir = makeGitRepo();
    fs.writeFileSync(path.join(dir, "f.txt"), "changed");
    const head = getHead(dir);
    expect(head.isClean).toBe(false);
    expect(head.dirtyCount).toBeGreaterThanOrEqual(1);
  });

  it("returns cache signature for git repo", () => {
    const dir = makeGitRepo();
    const sig1 = getCacheSignature(dir);
    expect(sig1.length).toBe(16);
    const sig2 = getCacheSignature(dir);
    expect(sig2).toBe(sig1);
  });

  it("changes signature when dirty", () => {
    const dir = makeGitRepo();
    const sigClean = getCacheSignature(dir);
    fs.writeFileSync(path.join(dir, "dirty.txt"), "x");
    const sigDirty = getCacheSignature(dir);
    expect(sigDirty).not.toBe(sigClean);
  });

  it("returns fallback for non-git dir", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-nogit-"));
    tmpDirs.push(dir);
    fs.writeFileSync(path.join(dir, "a.txt"), "x");
    const sig = getCacheSignature(dir);
    expect(sig).toMatch(/^\d+-\d+$/);
  });
});
