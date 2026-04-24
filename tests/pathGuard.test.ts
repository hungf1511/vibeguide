import { describe, it, expect } from "vitest";
import { resolveSafe, resolveRepo } from "../src/utils/pathGuard.js";
import * as path from "path";

describe("pathGuard", () => {
  describe("resolveSafe", () => {
    it("resolves a relative path inside repo", () => {
      const result = resolveSafe("src/index.ts", "/project");
      expect(result).toBe(path.resolve("/project/src/index.ts"));
    });

    it("resolves absolute path inside repo", () => {
      const result = resolveSafe("/project/src/index.ts", "/project");
      expect(result).toBe(path.resolve("/project/src/index.ts"));
    });

    it("throws on path traversal", () => {
      expect(() => resolveSafe("../secret.txt", "/project")).toThrow("Path traversal detected");
    });

    it("throws on null byte", () => {
      expect(() => resolveSafe("file\0.ts", "/project")).toThrow("null byte");
    });
  });

  describe("resolveRepo", () => {
    it("returns resolved repo path", () => {
      const result = resolveRepo("/project");
      expect(result).toBe(path.resolve("/project"));
    });

    it("defaults to cwd", () => {
      const result = resolveRepo();
      expect(result).toBe(process.cwd());
    });

    it("throws on null byte", () => {
      expect(() => resolveRepo("/pro\0ject")).toThrow("null byte");
    });
  });
});
