import { describe, it, expect } from "vitest";
import * as path from "path";
import { analyzeMonorepo } from "../src/utils/monorepo.js";

const FIXTURE = path.resolve("tests/fixtures/monorepo");

describe("monorepo", () => {
  it("detects monorepo from package.json workspaces", () => {
    const result = analyzeMonorepo(FIXTURE);
    expect(result.isMonorepo).toBe(true);
  });

  it("lists packages", () => {
    const result = analyzeMonorepo(FIXTURE);
    const names = result.packages.map((p) => p.name).sort();
    expect(names).toEqual(["@fixture/lib", "@fixture/web"]);
  });

  it("routes changed file to affected package", () => {
    const result = analyzeMonorepo(FIXTURE, ["apps/web/index.ts"]);
    const affected = result.packages.filter((p) => p.affectedBy && p.affectedBy.length > 0).map((p) => p.name);
    expect(affected).toContain("@fixture/web");
  });

  it("propagates to dependents", () => {
    const result = analyzeMonorepo(FIXTURE, ["packages/lib/index.ts"]);
    // affectedBy chỉ chứa file trực tiếp; summary liệt kê cả package bị ảnh hưởng gián tiếp
    expect(result.summary).toContain("@fixture/lib");
    expect(result.summary).toContain("@fixture/web");
  });
});
