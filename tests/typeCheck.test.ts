import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as cp from "child_process";

vi.mock("child_process", async () => {
  const actual = await vi.importActual<typeof cp>("child_process");
  return { ...actual, execFileSync: vi.fn() };
});

import { runTypeCheck } from "../src/utils/typeCheck.js";

describe("typeCheck branches", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vg-tc-"));
    vi.mocked(cp.execFileSync).mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses local tsc when present", () => {
    const localTsc = path.join(tmpDir, "node_modules", "typescript", "bin", "tsc");
    fs.mkdirSync(path.dirname(localTsc), { recursive: true });
    fs.writeFileSync(localTsc, "x", "utf-8");
    vi.mocked(cp.execFileSync).mockReturnValue("");
    runTypeCheck(tmpDir);
    const calls = vi.mocked(cp.execFileSync).mock.calls;
    expect(calls[0][0]).toBe(process.execPath);
  });

  it("falls back to global tsc", () => {
    vi.mocked(cp.execFileSync).mockReturnValue("");
    runTypeCheck(tmpDir);
    const calls = vi.mocked(cp.execFileSync).mock.calls;
    expect(calls[0][0]).toBe("tsc");
  });

  it("returns passed when no errors", () => {
    vi.mocked(cp.execFileSync).mockReturnValue("");
    const result = runTypeCheck(tmpDir);
    expect(result.passed).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("parses TS errors", () => {
    vi.mocked(cp.execFileSync).mockImplementation(() => {
      const err = new Error("tsc") as Error & { status: number; stdout: string; stderr: string };
      err.status = 2;
      err.stdout = "src/a.ts(1,1): error TS2322: Type mismatch.";
      err.stderr = "";
      throw err;
    });
    const result = runTypeCheck(tmpDir);
    expect(result.passed).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.errors[0].code).toBe("TS2322");
  });

  it("handles ENOENT", () => {
    vi.mocked(cp.execFileSync).mockImplementation(() => {
      const err = new Error("not found") as Error & { code: string };
      err.code = "ENOENT";
      throw err;
    });
    const result = runTypeCheck(tmpDir);
    expect(result.passed).toBe(false);
    expect(result.warningCount).toBe(1);
  });

  it("includes executionError in summary", () => {
    vi.mocked(cp.execFileSync).mockImplementation(() => {
      const err = new Error("exec failed") as Error & { status: number; stdout: string; stderr: string; message: string };
      err.status = 1;
      err.stdout = "";
      err.stderr = "";
      throw err;
    });
    const result = runTypeCheck(tmpDir);
    expect(result.summary).toContain("exec failed");
  });
});
