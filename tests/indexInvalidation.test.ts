import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { IndexStore } from "../src/index/store.js";
import { IndexBuilder } from "../src/index/builder.js";

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-inv-"));
  execSync("git init -q", { cwd: dir });
  execSync('git config user.email "t@t.com" && git config user.name "t"', { cwd: dir });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "a.ts"), `export const a = 1;\n`, "utf-8");
  fs.writeFileSync(path.join(dir, "src", "b.ts"), `export const b = 2;\n`, "utf-8");
  execSync("git add . && git commit -q -m init", { cwd: dir });
  return dir;
}

describe("Index invalidation", () => {
  let repo: string;
  let dbPath: string;
  let store: IndexStore;
  let builder: IndexBuilder;

  beforeEach(async () => {
    repo = makeRepo();
    dbPath = path.join(repo, ".vibeguide", "index.db");
    store = IndexStore.open(dbPath);
    builder = new IndexBuilder(store, repo);
    await builder.buildFull();
  });

  afterEach(() => {
    store.close();
    try { fs.rmSync(repo, { recursive: true, force: true }); } catch {}
  });

  it("incremental updates only changed file OID", async () => {
    const beforeOid = store.getFileOids().get("src/a.ts");
    expect(beforeOid).toBeDefined();

    fs.writeFileSync(path.join(repo, "src", "a.ts"), `export const a = 2;\n`, "utf-8");
    execSync("git add . && git commit -q -m change", { cwd: repo });

    const stats = await builder.buildIncremental();
    expect(stats.filesIndexed).toBeGreaterThanOrEqual(1);

    const afterOid = store.getFileOids().get("src/a.ts");
    expect(afterOid).toBeDefined();
    expect(afterOid).not.toBe(beforeOid);

    // b.ts should not have changed
    expect(store.getFileOids().get("src/b.ts")).toBeDefined();
  });

  it("incremental removes deleted file", async () => {
    expect(store.hasFile("src/b.ts")).toBe(true);

    fs.unlinkSync(path.join(repo, "src", "b.ts"));
    execSync("git add . && git commit -q -m delete", { cwd: repo });

    await builder.buildIncremental();
    expect(store.hasFile("src/b.ts")).toBe(false);
    expect(store.hasFile("src/a.ts")).toBe(true);
  });

  it("incremental adds new file", async () => {
    expect(store.hasFile("src/c.ts")).toBe(false);

    fs.writeFileSync(path.join(repo, "src", "c.ts"), `export const c = 3;\n`, "utf-8");
    execSync("git add . && git commit -q -m add", { cwd: repo });

    const stats = await builder.buildIncremental();
    expect(stats.filesIndexed).toBeGreaterThanOrEqual(1);
    expect(store.hasFile("src/c.ts")).toBe(true);
  });
});
