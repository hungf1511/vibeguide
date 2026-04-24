/** Đọc coverage report (coverage-summary.json hoặc lcov.info) và liệt kê file yếu. */
import * as fs from "fs";
import * as path from "path";
import type { TestCoverageResult } from "../types.js";
import { normalizePath } from "./scanner.js";

export function getTestCoverage(repo: string): TestCoverageResult {
  const summaryPath = path.join(repo, "coverage", "coverage-summary.json");
  if (fs.existsSync(summaryPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
      const totals = data.total;
      const t = {
        lines: totals?.lines?.pct ?? 0,
        branches: totals?.branches?.pct ?? 0,
        functions: totals?.functions?.pct ?? 0,
        statements: totals?.statements?.pct ?? 0,
      };
      const weak: { file: string; lines: number }[] = [];
      for (const [file, val] of Object.entries(data)) {
        if (file === "total") continue;
        const v = val as { lines?: { pct?: number } };
        const pct = v.lines?.pct ?? 0;
        if (pct < 50) weak.push({ file: normalizePath(file), lines: pct });
      }
      weak.sort((a, b) => a.lines - b.lines);
      const summary = "Coverage tong: lines " + t.lines + "%, branches " + t.branches + "%, functions " + t.functions + "%. " + weak.length + " file duoi 50%.";
      return { found: true, source: "coverage-summary.json", totals: t, weakFiles: weak.slice(0, 10), summary };
    } catch { /* fall through */ }
  }

  const lcovPath = path.join(repo, "coverage", "lcov.info");
  if (fs.existsSync(lcovPath)) {
    try {
      const content = fs.readFileSync(lcovPath, "utf-8");
      let totalLF = 0, totalLH = 0;
      const records = content.split("end_of_record");
      const fileStats: { file: string; lines: number }[] = [];
      for (const rec of records) {
        const sf = /SF:(.+)/.exec(rec);
        const lf = /LF:(\d+)/.exec(rec);
        const lh = /LH:(\d+)/.exec(rec);
        if (sf && lf && lh) {
          const f = parseInt(lf[1], 10);
          const h = parseInt(lh[1], 10);
          totalLF += f;
          totalLH += h;
          const pct = f > 0 ? Math.round((h / f) * 100) : 0;
          if (pct < 50) fileStats.push({ file: normalizePath(path.relative(repo, sf[1])), lines: pct });
        }
      }
      const linesPct = totalLF > 0 ? Math.round((totalLH / totalLF) * 100) : 0;
      fileStats.sort((a, b) => a.lines - b.lines);
      return {
        found: true,
        source: "lcov.info",
        totals: { lines: linesPct, branches: 0, functions: 0, statements: linesPct },
        weakFiles: fileStats.slice(0, 10),
        summary: "Coverage lines: " + linesPct + "%. " + fileStats.length + " file duoi 50%.",
      };
    } catch { /* fall through */ }
  }

  return {
    found: false,
    weakFiles: [],
    summary: "Khong tim thay coverage report. Chay npm test --coverage de tao coverage/coverage-summary.json.",
  };
}
