import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { IndexStore } from "../src/index/store.js";

function tmpDb(): string {
  return path.join(os.tmpdir(), `vg-store-${Date.now()}.db`);
}

describe("IndexStore", () => {
  let dbPath: string;
  let store: IndexStore;

  beforeEach(() => {
    dbPath = tmpDb();
    store = IndexStore.open(dbPath);
  });

  afterEach(() => {
    store.close();
    try { fs.unlinkSync(dbPath); } catch {}
  });

  it("opens new database with schema version 2", () => {
    expect(store.getSchemaVersion()).toBe(2);
  });

  it("re-opens existing without re-running migrations", () => {
    store.close();
    const store2 = IndexStore.open(dbPath);
    expect(store2.getSchemaVersion()).toBe(2);
    store2.close();
  });

  it("upserts and retrieves a file", () => {
    store.upsertFile({ path: "src/app.ts", git_oid: "abc123", language: "typescript", lines: 42, last_indexed_at: 1_000_000 });
    expect(store.hasFile("src/app.ts")).toBe(true);
    expect(store.countFiles()).toBe(1);
  });

  it("upserts imports and deletes per file", () => {
    store.upsertFile({ path: "a.ts", git_oid: "a1" });
    store.upsertFile({ path: "b.ts", git_oid: "b1" });
    store.upsertImport({ from_file: "a.ts", to_file: "b.ts", specifier: "./b" });
    store.deleteImportsForFile("a.ts");
    store.deleteFile("a.ts");
    expect(store.hasFile("a.ts")).toBe(false);
    expect(store.hasFile("b.ts")).toBe(true);
  });

  it("upserts exports and symbols", () => {
    store.upsertFile({ path: "x.ts", git_oid: "x1" });
    store.upsertExport({ file: "x.ts", symbol: "foo", kind: "function", line: 3 });
    store.upsertSymbol({ file: "x.ts", name: "foo", kind: "function", line: 3, scope: "module" });
    expect(store.countFiles()).toBe(1);
  });

  it("upserts commits", () => {
    store.upsertCommit({ sha: "abc", author: "A", message: "m", timestamp: 1_000_000 });
    expect(store.countFiles()).toBe(0);
  });

  it("rolls back transaction on throw", () => {
    let thrown = false;
    try {
      store.transaction(() => {
        store.upsertFile({ path: "rollback.ts", git_oid: "r1" });
        throw new Error("abort");
      });
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
    expect(store.hasFile("rollback.ts")).toBe(false);
  });

  it("gets file OID map", () => {
    store.upsertFile({ path: "f1.ts", git_oid: "oid1" });
    store.upsertFile({ path: "f2.ts", git_oid: "oid2" });
    const map = store.getFileOids();
    expect(map.get("f1.ts")).toBe("oid1");
    expect(map.get("f2.ts")).toBe("oid2");
  });

  it("tracks last indexed timestamp", () => {
    expect(store.getLastIndexedAt()).toBeUndefined();
    store.upsertFile({ path: "t.ts", git_oid: "t1", last_indexed_at: 1_234_567 });
    expect(store.getLastIndexedAt()).toBe(1_234_567);
  });

  it("upserts embeddings", () => {
    store.upsertFile({ path: "emb.ts", git_oid: "e1" });
    store.upsertEmbedding("emb.ts", 0, Buffer.from([1, 2, 3]));
    expect(store.hasFile("emb.ts")).toBe(true);
  });

  it("hasFile returns false for missing file", () => {
    expect(store.hasFile("nonexistent.ts")).toBe(false);
  });
it("cascades delete from files to imports/exports/symbols", () => {
    store.upsertFile({ path: "x.ts", git_oid: "x1" });
    store.upsertFile({ path: "y.ts", git_oid: "y1" });
    store.upsertImport({ from_file: "x.ts", to_file: "y.ts", specifier: "./y" });
    store.upsertExport({ file: "x.ts", symbol: "foo", kind: "function", line: 1 });
    store.upsertSymbol({ file: "x.ts", name: "foo", kind: "function", line: 1, scope: "module" });

    store.deleteFile("x.ts");

    expect(store.countImportsFrom("x.ts")).toBe(0);
    expect(store.countExportsOf("x.ts")).toBe(0);
    expect(store.countSymbolsOf("x.ts")).toBe(0);
    expect(store.hasFile("y.ts")).toBe(true);
  });

  it("data persists across re-open", () => {
    store.upsertFile({ path: "persist.ts", git_oid: "p1" });
    store.close();

    const store2 = IndexStore.open(dbPath);
    expect(store2.hasFile("persist.ts")).toBe(true);
    expect(store2.countFiles()).toBe(1);
    store2.close();
  });

  it("refuses DB with future schema version", () => {
    store.upsertFile({ path: "x.ts", git_oid: "old" });
    store.close();

    const raw = new (require("better-sqlite3").default || require("better-sqlite3"))(dbPath);
    raw.pragma("user_version = 99");
    raw.close();

    expect(() => IndexStore.open(dbPath)).toThrow("newer than supported");
  });

});
