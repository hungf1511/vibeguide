/** Phân tích độ phức tạp code (LOC + cyclomatic) cho từng file. */
import * as fs from "fs";
import * as path from "path";
import type { ComplexityResult } from "../types.js";
import { getAllSourceFiles } from "./scanner.js";

export function analyzeComplexity(repo: string, opts: { thresholdLoc?: number; thresholdComplexity?: number } = {}): ComplexityResult {
  const thresholdLoc = opts.thresholdLoc ?? 500;
  const thresholdComplexity = opts.thresholdComplexity ?? 15;
  const files = getAllSourceFiles(repo);
  const results: ComplexityResult["files"] = [];
  for (const file of files) {
    const full = path.join(repo, file);
    let content = "";
    try { content = fs.readFileSync(full, "utf-8"); } catch { continue; }
    const loc = content.split("\n").filter((l) => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l)).length;
    const cyclomatic = countComplexity(content);
    const flagged = loc > thresholdLoc || cyclomatic > thresholdComplexity;
    let reason: string | undefined;
    if (loc > thresholdLoc && cyclomatic > thresholdComplexity) reason = "LOC " + loc + " > " + thresholdLoc + " va cyclomatic " + cyclomatic + " > " + thresholdComplexity;
    else if (loc > thresholdLoc) reason = "File qua dai: " + loc + " LOC > " + thresholdLoc;
    else if (cyclomatic > thresholdComplexity) reason = "Logic qua phuc tap: cyclomatic " + cyclomatic + " > " + thresholdComplexity;
    results.push({ file, loc, cyclomatic, flagged, reason });
  }
  results.sort((a, b) => (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0) || b.loc - a.loc);
  const flaggedCount = results.filter((r) => r.flagged).length;
  return {
    files: results.slice(0, 30),
    summary: flaggedCount === 0
      ? "Tat ca " + results.length + " file duoi nguong phuc tap."
      : flaggedCount + "/" + results.length + " file vuot nguong (LOC>" + thresholdLoc + " hoac cyclomatic>" + thresholdComplexity + ").",
    thresholdLoc,
    thresholdComplexity,
  };
}

function countComplexity(content: string): number {
  let count = 1;
  const decisionPoints = [
    /\bif\s*\(/g,
    /\belse\s+if\b/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+\s*:/g,
    /&&/g,
    /\|\|/g,
  ];
  for (const re of decisionPoints) {
    const matches = content.match(re);
    if (matches) count += matches.length;
  }
  return count;
}
