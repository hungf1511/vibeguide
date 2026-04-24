import { describe, it, expect } from "vitest";
import * as path from "path";
import { normalizePath, getAllSourceFiles, scanDependencies } from "../src/utils/scanner.js";

const FIXTURE = path.resolve("tests/fixtures/small-repo");

describe("scanner", () => {
  describe("normalizePath", () => {
    it("converts backslashes to forward slashes", () => {
      const input = "src" + "\\" + "utils" + "\\" + "file.ts";
      expect(normalizePath(input)).toBe("src/utils/file.ts");
    });

    it("leaves forward slashes alone", () => {
      expect(normalizePath("src/utils/file.ts")).toBe("src/utils/file.ts");
    });
  });

  describe("getAllSourceFiles", () => {
    it("lists TS files in fixture", () => {
      const files = getAllSourceFiles(FIXTURE);
      const names = files.map((f) => path.basename(f)).sort();
      expect(names).toEqual(["helper.ts", "index.ts"]);
    });
  });

  describe("scanDependencies", () => {
    it("finds import edge between helper and index", () => {
      const graph = scanDependencies(FIXTURE);
      const edges = graph.edges;
      const importEdge = edges.find((e) => e.from === "helper.ts" && e.to === "index.ts");
      expect(importEdge).toBeDefined();
    });

    it("includes both files as nodes", () => {
      const graph = scanDependencies(FIXTURE);
      expect(graph.nodes).toContain("index.ts");
      expect(graph.nodes).toContain("helper.ts");
    });
  });
});
