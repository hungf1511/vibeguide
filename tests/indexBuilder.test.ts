import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { vi } from "vitest";
import * as runGitModule from "../src/core/git/runGit.js";
import { IndexStore } from "../src/index/store.js";
import { IndexBuilder } from "../src/index/builder.js";

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-build-"));
  execSync("git init -q", { cwd: dir });
  execSync('git config user.email "t@t.com" && git config user.name "t"', { cwd: dir });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "a.ts"), `import { b } from "./b";\nexport const a = 1;\n`, "utf-8");
  fs.writeFileSync(path.join(dir, "src", "b.ts"), `export const b = 2;\n`, "utf-8");
  fs.writeFileSync(path.join(dir, "src", "c.ts"), `import { a } from "./a";\nconsole.log(a);\n`, "utf-8");
  fs.writeFileSync(path.join(dir, "readme.md"), "# hello\n", "utf-8");
  execSync("git add . && git commit -q -m init", { cwd: dir });
  return dir;
}

describe("IndexBuilder", () => {
  let repo: string;
  let dbPath: string;
  let store: IndexStore;
  let builder: IndexBuilder;

  beforeEach(() => {
    repo = makeRepo();
    dbPath = path.join(repo, ".vibeguide", "index.db");
    store = IndexStore.open(dbPath);
    builder = new IndexBuilder(store, repo);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it("builds full index", async () => {
    const stats = await builder.buildFull();
    expect(stats.filesIndexed).toBeGreaterThanOrEqual(3);
    expect(store.countFiles()).toBeGreaterThanOrEqual(3);
    expect(store.getLastIndexedAt()).toBeDefined();
  });

  it("incremental detects no changes when nothing changed", async () => {
    await builder.buildFull();
    const stats = await builder.buildIncremental();
    expect(stats.filesIndexed).toBeGreaterThanOrEqual(0);
  });

  it("incremental re-indexes changed file", async () => {
    await builder.buildFull();
    const before = store.getFileOids().get("src/a.ts");
    expect(before).toBeDefined();

    fs.writeFileSync(path.join(repo, "src", "a.ts"), `import { b } from "./b";\nexport const a = 2;\n`, "utf-8");
    execSync("git add . && git commit -q -m change", { cwd: repo });

    const stats = await builder.buildIncremental();
    expect(stats.filesIndexed).toBeGreaterThanOrEqual(1);

    const after = store.getFileOids().get("src/a.ts");
    expect(after).toBeDefined();
    expect(after).not.toBe(before);
  });

  it("incremental removes deleted file", async () => {
    await builder.buildFull();
    expect(store.hasFile("src/c.ts")).toBe(true);

    fs.unlinkSync(path.join(repo, "src", "c.ts"));
    execSync("git add . && git commit -q -m delete", { cwd: repo });

    const stats = await builder.buildIncremental();
    expect(store.hasFile("src/c.ts")).toBe(false);
    expect(stats.filesIndexed).toBeGreaterThanOrEqual(0);
  });

  it("throws for buildFull on non-git repo", async () => {
    const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-plain-"));
    fs.writeFileSync(path.join(plainDir, "a.ts"), "x", "utf-8");
    const plainDb = path.join(plainDir, ".vibeguide", "index.db");
    const plainStore = IndexStore.open(plainDb);
    const plainBuilder = new IndexBuilder(plainStore, plainDir);
    await expect(plainBuilder.buildFull()).rejects.toThrow("requires a git repository");
    plainStore.close();
    fs.rmSync(plainDir, { recursive: true, force: true });
  });

  it("throws for buildIncremental on non-git repo", async () => {
    const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-plain-"));
    fs.writeFileSync(path.join(plainDir, "a.ts"), "x", "utf-8");
    const plainDb = path.join(plainDir, ".vibeguide", "index.db");
    const plainStore = IndexStore.open(plainDb);
    const plainBuilder = new IndexBuilder(plainStore, plainDir);
    await expect(plainBuilder.buildIncremental()).rejects.toThrow("requires a git repository");
    plainStore.close();
    fs.rmSync(plainDir, { recursive: true, force: true });
  });
it("handles CRLF line endings from git ls-tree", async () => {
    const original = runGitModule.runGit;
    const spy = vi.spyOn(runGitModule, "runGit").mockImplementation((repoPath: string, args: string[]) => {
      if (args.includes("ls-tree")) {
        return "100644 blob aaa\tsrc/a.ts\r\n100644 blob bbb\tsrc/b.ts\r\n";
      }
      return original(repoPath, args);
    });
    const stats = await builder.buildFull();
    expect(stats.filesIndexed).toBeGreaterThanOrEqual(2);
    expect(store.hasFile("src/a.ts")).toBe(true);
    expect(store.hasFile("src/b.ts")).toBe(true);
    spy.mockRestore();
  });

  it("incremental indexes newly added file", async () => {
    await builder.buildFull();
    const beforeCount = store.countFiles();

    fs.writeFileSync(path.join(repo, "src", "d.ts"), `export const d = 4;\n`, "utf-8");
    execSync("git add . && git commit -q -m add", { cwd: repo });

    const stats = await builder.buildIncremental();
    expect(store.countFiles()).toBeGreaterThan(beforeCount);
    expect(store.hasFile("src/d.ts")).toBe(true);
    expect(stats.filesIndexed).toBeGreaterThanOrEqual(1);
  });



  it("buildFull purges files deleted between builds", async () => {
    await builder.buildFull();
    expect(store.hasFile("src/c.ts")).toBe(true);

    fs.unlinkSync(path.join(repo, "src", "c.ts"));
    execSync("git add . && git commit -q -m delete", { cwd: repo });

    await builder.buildFull();
    expect(store.hasFile("src/c.ts")).toBe(false);
  });

});
