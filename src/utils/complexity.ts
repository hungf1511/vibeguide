/** Phân tích d? ph?c t?p code (LOC + cyclomatic) cho t?ng file. */
import * as fs from "fs";
import * as path from "path";
import type { ComplexityResult } from "../types.js";
import { getAllSourceFiles } from "./scanner.js";
import { stripNonCode } from "./codeText.js";

type FileComplexity = ComplexityResult["files"][number];

/** Compute cyclomatic complexity and LOC per file. */
export function analyzeComplexity(repo: string, opts: { thresholdLoc?: number; thresholdComplexity?: number } = {}): ComplexityResult {
  const thresholdLoc = opts.thresholdLoc ?? 500;
  const thresholdComplexity = opts.thresholdComplexity ?? 15;
  const files = getAllSourceFiles(repo);
  const results: ComplexityResult["files"] = [];

  for (const file of files) {
    const result = analyzeFile(repo, file, thresholdLoc, thresholdComplexity);
    if (result) results.push(result);
  }

  results.sort((a, b) => (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0) || b.loc - a.loc);
  const flaggedCount = results.filter((r) => r.flagged).length;
  return {
    files: results.slice(0, 30),
    summary: flaggedCount === 0
      ? "Tat ca " + results.length + " file duoi nguong phuc tap."
      : flaggedCount + "/" + results.length + " file vuot nguong (LOC>" + thresholdLoc + " hoac max cyclomatic>" + thresholdComplexity + ").",
    thresholdLoc,
    thresholdComplexity,
  };
}

function analyzeFile(repo: string, file: string, thresholdLoc: number, thresholdComplexity: number): FileComplexity | null {
  let content = "";
  try {
    content = fs.readFileSync(path.join(repo, file), "utf-8");
  } catch {
    return null;
  }

  const code = stripNonCode(content);
  const loc = code.split("\n").filter((l) => l.trim()).length;
  const cyclomatic = countMaxFunctionComplexity(code);
  const exemptFromLoc = isLocOnlyExempt(file, code, cyclomatic);
  const flagged = shouldFlag(loc, cyclomatic, thresholdLoc, thresholdComplexity, exemptFromLoc);
  const reason = flagged ? buildReason(loc, cyclomatic, thresholdLoc, thresholdComplexity, exemptFromLoc) : undefined;

  return { file, loc, cyclomatic, flagged, reason };
}

function isLocOnlyExempt(file: string, code: string, cyclomatic: number): boolean {
  return cyclomatic <= 2 && (isTypeOnlyFile(file, code) || isStaticDataFile(code));
}

function shouldFlag(loc: number, cyclomatic: number, thresholdLoc: number, thresholdComplexity: number, exemptFromLoc: boolean): boolean {
  if (cyclomatic > thresholdComplexity) return true;
  return loc > thresholdLoc && !exemptFromLoc;
}

function buildReason(loc: number, cyclomatic: number, thresholdLoc: number, thresholdComplexity: number, exemptFromLoc: boolean): string | undefined {
  const locHigh = loc > thresholdLoc && !exemptFromLoc;
  const complexityHigh = cyclomatic > thresholdComplexity;
  if (locHigh && complexityHigh) return "LOC " + loc + " > " + thresholdLoc + " va max cyclomatic " + cyclomatic + " > " + thresholdComplexity;
  if (locHigh) return "File qua dai: " + loc + " LOC > " + thresholdLoc;
  if (complexityHigh) return "Logic qua phuc tap: max cyclomatic " + cyclomatic + " > " + thresholdComplexity;
  return undefined;
}

function isTypeOnlyFile(file: string, code: string): boolean {
  if (!/(^|\/)types?\.ts$/.test(file)) return false;
  return !/\b(?:function|const|let|var|class)\b/.test(code);
}

function isStaticDataFile(code: string): boolean {
  const hasExportedData = /\bexport\s+const\s+[A-Za-z_$][\w$]*(?:\s*:[^=]+)?\s*=\s*[\[{]/.test(code);
  const hasLogic = /\b(?:function|class|if|for|while|switch|try|catch)\b|=>/.test(code);
  return hasExportedData && !hasLogic;
}

function countMaxFunctionComplexity(content: string): number {
  const ranges = findFunctionRanges(content);
  if (ranges.length === 0) return countComplexity(content);
  return Math.max(...ranges.map(([start, end]) => countComplexity(content.slice(start, end))));
}

function findFunctionRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const patterns = [
    /\b(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:\s*:\s*[^=]+)?\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::\s*[^=]+)?=>\s*\{/g,
    /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:\s*:\s*[^=]+)?\s*=\s*(?:async\s+)?function(?:\s+[A-Za-z_$][\w$]*)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const openBrace = match.index + match[0].length - 1;
      const closeBrace = findMatchingBrace(content, openBrace);
      if (closeBrace > openBrace) ranges.push([openBrace, closeBrace + 1]);
    }
    pattern.lastIndex = 0;
  }

  return ranges;
}

function findMatchingBrace(content: string, openBrace: number): number {
  let depth = 0;
  for (let i = openBrace; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function countComplexity(content: string): number {
  let count = 1;
  const decisionPoints = [
    /\bif\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:?\n][^:\n]*:/g,
    /&&/g,
    /\|\|/g,
  ];
  for (const re of decisionPoints) {
    const matches = content.match(re);
    if (matches) count += matches.length;
  }
  return count;
}
