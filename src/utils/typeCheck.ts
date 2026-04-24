/** Chạy TypeScript compiler (--noEmit) và parse lỗi ra struct có message tiếng Việt. */
import * as path from "path";
import * as cp from "child_process";
import * as fs from "fs";
import type { TypeCheckResult, TypeError } from "../types.js";
import { normalizePath } from "./scanner.js";

export function runTypeCheck(repo: string): TypeCheckResult {
  const start = Date.now();
  const errors: TypeError[] = [];
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  let executionError = "";

  const localTscJs = path.join(repo, "node_modules", "typescript", "bin", "tsc");
  const command = fs.existsSync(localTscJs) ? process.execPath : "tsc";
  const commandArgs = fs.existsSync(localTscJs) ? [localTscJs, "--noEmit", "--pretty", "false"] : ["--noEmit", "--pretty", "false"];

  try {
    stdout = cp.execFileSync(command, commandArgs, { cwd: repo, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    const e = err as { status?: number; code?: string; stdout?: string; stderr?: string; message?: string };
    exitCode = e.status ?? (e.code === "ENOENT" ? 127 : 1);
    stdout = (e.stdout ?? "").toString();
    stderr = (e.stderr ?? "").toString();
    executionError = e.message ?? "";
  }

  const combined = stdout + "\n" + stderr;
  const lineRegex = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(combined)) !== null) {
    const file = normalizePath(path.relative(repo, path.resolve(repo, match[1])));
    errors.push({
      file,
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[5],
      message: match[6].trim(),
      messageVi: translateTsError(match[5], match[6].trim()),
    });
  }

  const errorCount = errors.length;
  const compilerUnavailable = exitCode !== 0 && errorCount === 0;
  const passed = exitCode === 0 && errorCount === 0;
  let summary: string;
  if (compilerUnavailable) {
    summary = "Khong chay duoc TypeScript compiler hoac khong parse duoc loi. Hay chay npm run build de xem chi tiet.";
  } else if (passed) {
    summary = "TypeScript pass - khong co loi compile.";
  } else {
    summary = "Phat hien " + errorCount + " loi TypeScript" + (errors[0] ? " - dau tien: " + errors[0].file + ":" + errors[0].line + " (" + errors[0].code + ")" : "") + ".";
  }

  return {
    passed,
    errorCount,
    warningCount: compilerUnavailable ? 1 : 0,
    errors: errors.slice(0, 50),
    summary: executionError && compilerUnavailable ? summary + " (" + executionError + ")" : summary,
    durationMs: Date.now() - start,
  };
}

function translateTsError(code: string, msg: string): string {
  const map: Record<string, string> = {
    TS2304: "Ten bien/type khong ton tai - kiem tra import hoac chinh ta",
    TS2322: "Kieu du lieu khong khop khi gan - sai type",
    TS2339: "Property khong ton tai tren object - sai ten hoac thieu type",
    TS2345: "Tham so goi ham sai kieu",
    TS2532: "Object co the undefined - can kiem tra null truoc",
    TS2554: "So tham so khong khop khi goi ham",
    TS7006: "Tham so ngam co kieu any - them type annotation",
    TS18046: "Bien co kieu unknown - can type guard truoc khi dung",
  };
  return map[code] || ("Loi compile: " + msg);
}
