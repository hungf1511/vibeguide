import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { getIfFresh, set } from "../src/utils/cache.js";

const TEST_CACHE_DIR = path.resolve(process.cwd(), "cache");

describe("cache", () => {
  const repo = path.resolve("tests/fixtures/small-repo");

  beforeEach(() => {
    // Clean any stale cache for this repo
    const key = repo.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";
    const p = path.join(TEST_CACHE_DIR, key);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  afterEach(() => {
    const key = repo.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";
    const p = path.join(TEST_CACHE_DIR, key);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  it("returns null when cache miss", () => {
    const result = getIfFresh(repo, "sig1");
    expect(result).toBeNull();
  });

  it("returns data when signature matches", () => {
    const data = { nodes: ["a.ts"], edges: [{ from: "a.ts", to: "b.ts" }] };
    set(repo, data, "sig1");
    const result = getIfFresh(repo, "sig1");
    expect(result).toEqual(data);
  });

  it("returns null when signature mismatches", () => {
    const data = { nodes: ["a.ts"] };
    set(repo, data, "sig1");
    const result = getIfFresh(repo, "sig2");
    expect(result).toBeNull();
  });
});
