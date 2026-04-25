import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { IndexStore } from "../src/index/store.js";
import { IndexBuilder } from "../src/index/builder.js";
import { InMemoryQueries } from "../src/index/queries/inMemory.js";
import { getQueries } from "../src/index/queries/factory.js";
import { SqliteQueries } from "../src/index/queries/sqlite.js";

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-parity-"));
  execSync("git init -q", { cwd: dir });
  execSync('git config user.email "t@t.com" && git config user.name "t"', { cwd: dir });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(path.join(dir, "src", "a.ts"), `import { b } from "./b";\nexport const a = 1;\n`, "utf-8");
  fs.writeFileSync(path.join(dir, "src", "b.ts"), `import { c } from "./c";\nexport const b = 2;\n`, "utf-8");
  fs.writeFileSync(path.join(dir, "src", "c.ts"), `export const c = 3;\n`, "utf-8");
  fs.writeFileSync(path.join(dir, "readme.md"), "# hello\n", "utf-8");
  execSync("git add . && git commit -q -m init", { cwd: dir });
  return dir;
}

describe("Queries parity", () => {
  let repo: string;
  let dbPath: string;
  let store: IndexStore;

  beforeEach(async () => {
    repo = makeRepo();
    dbPath = path.join(repo, ".vibeguide", "index.db");
    store = IndexStore.open(dbPath);
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
  });

  afterEach(() => {
    store.close();
    try { fs.rmSync(repo, { recursive: true, force: true }); } catch {}
  });

  it("getDependencyGraph parity", async () => {
    const mem = new InMemoryQueries(repo);
    const sql = new SqliteQueries(store, repo);

    const memGraph = await mem.getDependencyGraph();
    const sqlGraph = await sql.getDependencyGraph();

    expect(sqlGraph.nodes.sort()).toEqual(memGraph.nodes.sort());
    expect(sqlGraph.edges.sort((a, b) => `${a.from}-${a.to}`.localeCompare(`${b.from}-${b.to}`)))
      .toEqual(memGraph.edges.sort((a, b) => `${a.from}-${a.to}`.localeCompare(`${b.from}-${b.to}`)));
  });

  it("getDependents parity", async () => {
    const mem = new InMemoryQueries(repo);
    const sql = new SqliteQueries(store, repo);

    const memDeps = await mem.getDependents("src/b.ts");
    const sqlDeps = await sql.getDependents("src/b.ts");

    expect(sqlDeps.sort()).toEqual(memDeps.sort());
  });

  it("getDependencies parity", async () => {
    const mem = new InMemoryQueries(repo);
    const sql = new SqliteQueries(store, repo);

    const memDeps = await mem.getDependencies("src/a.ts");
    const sqlDeps = await sql.getDependencies("src/a.ts");

    expect(sqlDeps.sort()).toEqual(memDeps.sort());
  });

  it("getDependencyGraph with scope filtering", async () => {
    const sql = new SqliteQueries(store, repo);
    const graph = await sql.getDependencyGraph({ paths: ["src/a.ts", "src/b.ts"] });
    expect(graph.nodes).toContain("src/a.ts");
    expect(graph.nodes).toContain("src/b.ts");
    expect(graph.nodes).not.toContain("src/c.ts");
  });

  it("excludes external imports from graph", async () => {
    fs.writeFileSync(path.join(repo, "src", "d.ts"), `import React from "react";\nexport const d = 4;\n`, "utf-8");
    execSync("git add . && git commit -q -m add", { cwd: repo });
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
    const sql = new SqliteQueries(store, repo);
    const graph = await sql.getDependencyGraph();
    const edgesToReact = graph.edges.filter((e) => e.to === "react");
    expect(edgesToReact).toEqual([]);
    expect(graph.edges.some((e) => e.from === "src/a.ts" && e.to === "src/b.ts")).toBe(true);
  });

  it("scope filter handles folder prefix", async () => {
    fs.mkdirSync(path.join(repo, "tests"), { recursive: true });
    fs.writeFileSync(path.join(repo, "tests", "x.ts"), `export const x = 1;\n`, "utf-8");
    execSync("git add . && git commit -q -m add", { cwd: repo });
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
    const sql = new SqliteQueries(store, repo);
    const graph = await sql.getDependencyGraph({ paths: ["src"] });
    expect(graph.nodes).toContain("src/a.ts");
    expect(graph.nodes).not.toContain("tests/x.ts");
  });
});

describe("getQueries factory", () => {
  let repo: string;

  beforeEach(() => {
    repo = makeRepo();
  });

  afterEach(() => {
    try { fs.rmSync(repo, { recursive: true, force: true }); } catch {}
  });

  it("returns InMemoryQueries when no index exists", async () => {
    const queries = await getQueries(repo);
    expect(queries.constructor.name).toBe("InMemoryQueries");
  });

  it("uses SQLite when signature matches", async () => {
    const dbPath = path.join(repo, ".vibeguide", "index.db");
    const store = IndexStore.open(dbPath);
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
    store.close();

    const queries = await getQueries(repo);
    expect(queries.constructor.name).toBe("SqliteQueries");
    (queries as any).close?.();
  });

  it("falls back to InMemory when signature mismatches and AUTO_INDEX disabled", async () => {
    const dbPath = path.join(repo, ".vibeguide", "index.db");
    const store = IndexStore.open(dbPath);
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
    store.close();

    fs.writeFileSync(path.join(repo, "src", "mod.ts"), `export const mod = 1;\n`, "utf-8");
    execSync("git add . && git commit -q -m mod", { cwd: repo });

    const queries = await getQueries(repo);
    expect(queries.constructor.name).toBe("InMemoryQueries");
  });

  it("auto-rebuilds when AUTO_INDEX=1", async () => {
    process.env.VIBEGUIDE_AUTO_INDEX = "1";
    try {
      const dbPath = path.join(repo, ".vibeguide", "index.db");
      const store = IndexStore.open(dbPath);
      const builder = new IndexBuilder(store, repo);
      await builder.buildFull();
      store.close();

      fs.writeFileSync(path.join(repo, "src", "mod.ts"), `export const mod = 1;\n`, "utf-8");
      execSync("git add . && git commit -q -m mod", { cwd: repo });

      const queries = await getQueries(repo);
      expect(queries.constructor.name).toBe("SqliteQueries");

      const graph = await queries.getDependencyGraph();
      expect(graph.nodes).toContain("src/mod.ts");

      (queries as any).close?.();
    } finally {
      delete process.env.VIBEGUIDE_AUTO_INDEX;
    }
  });

  it("dedupes concurrent rebuild via process-local lock", async () => {
    process.env.VIBEGUIDE_AUTO_INDEX = "1";
    try {
      const dbPath = path.join(repo, ".vibeguide", "index.db");
      const store = IndexStore.open(dbPath);
      const builder = new IndexBuilder(store, repo);
      await builder.buildFull();
      store.close();

      fs.writeFileSync(path.join(repo, "src", "mod.ts"), `export const mod = 1;\n`, "utf-8");
      execSync("git add . && git commit -q -m mod", { cwd: repo });

      const spy = vi.spyOn(IndexBuilder.prototype, "buildIncremental");

      const promises = Array.from({ length: 5 }, () => getQueries(repo));
      const results = await Promise.all(promises);

      expect(spy).toHaveBeenCalledTimes(1);
      for (const q of results) {
        expect(q.constructor.name).toBe("SqliteQueries");
      }

      spy.mockRestore();
    } finally {
      delete process.env.VIBEGUIDE_AUTO_INDEX;
    }
  });

  it("factory falls back to InMemory when DB has future schema", async () => {
    const dbPath = path.join(repo, ".vibeguide", "index.db");
    const store = IndexStore.open(dbPath);
    store.upsertFile({ path: "x.ts", git_oid: "old" });
    store.close();

    const raw = new (require("better-sqlite3").default || require("better-sqlite3"))(dbPath);
    raw.pragma("user_version = 99");
    raw.close();

    const queries = await getQueries(repo);
    expect(queries.constructor.name).toBe("InMemoryQueries");
  });
});

describe("signature invalidation scenarios", () => {
  let repo: string;

  beforeEach(() => {
    repo = makeRepo();
  });

  afterEach(() => {
    try { fs.rmSync(repo, { recursive: true, force: true }); } catch {}
  });

  it("invalidates when file edited but not committed", async () => {
    const dbPath = path.join(repo, ".vibeguide", "index.db");
    const store = IndexStore.open(dbPath);
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
    store.close();

    fs.writeFileSync(path.join(repo, "src", "a.ts"), `export const a = 99;\n`, "utf-8");

    const queries = await getQueries(repo);
    expect(queries.constructor.name).toBe("InMemoryQueries");
    (queries as any).close?.();
  });

  it("invalidates when file staged", async () => {
    const dbPath = path.join(repo, ".vibeguide", "index.db");
    const store = IndexStore.open(dbPath);
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
    store.close();

    fs.writeFileSync(path.join(repo, "src", "a.ts"), `export const a = 99;\n`, "utf-8");
    execSync("git add .", { cwd: repo });

    const queries = await getQueries(repo);
    expect(queries.constructor.name).toBe("InMemoryQueries");
    (queries as any).close?.();
  });

  it("invalidates when HEAD changes (new commit)", async () => {
    const dbPath = path.join(repo, ".vibeguide", "index.db");
    const store = IndexStore.open(dbPath);
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
    store.close();

    fs.writeFileSync(path.join(repo, "src", "mod.ts"), `export const mod = 1;\n`, "utf-8");
    execSync("git add . && git commit -q -m mod", { cwd: repo });

    const queries = await getQueries(repo);
    expect(queries.constructor.name).toBe("InMemoryQueries");
    (queries as any).close?.();
  });

  it("returns SQLite when nothing changed between calls", async () => {
    const dbPath = path.join(repo, ".vibeguide", "index.db");
    const store = IndexStore.open(dbPath);
    const builder = new IndexBuilder(store, repo);
    await builder.buildFull();
    store.close();

    const queries = await getQueries(repo);
    expect(queries.constructor.name).toBe("SqliteQueries");
    (queries as any).close?.();
  });
});
