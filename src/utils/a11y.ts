/** Quet loi tiep can co ban (alt, aria-label, href, label) trong JSX/TSX. */
import type { A11yResult, A11yIssue } from "../types.js";
import { getAllSourceFiles } from "./scanner.js";
import { readSafe } from "./readSafe.js";

interface A11yLineRule {
  rule: string;
  message: string;
  matches: (line: string) => boolean;
}

const A11Y_LINE_RULES: A11yLineRule[] = [
  {
    rule: "img-alt",
    message: "Tag <img> thieu thuoc tinh alt",
    matches: (line) => /<img\b/i.test(line) && !/\balt\s*=/.test(line),
  },
  {
    rule: "button-name",
    message: "Button khong co text hoac aria-label",
    matches: (line) => {
      const btnMatch = /<button\b([^>]*)>([\s\S]*?)<\/button>/i.exec(line);
      return Boolean(btnMatch && !/aria-label/.test(btnMatch[1]) && !btnMatch[2].trim());
    },
  },
  {
    rule: "anchor-href",
    message: "<a onClick> can co href - dung <button> thay the",
    matches: (line) => /<a\b[^>]*onClick/i.test(line) && !/href\s*=/.test(line),
  },
  {
    rule: "input-label",
    message: "<input> thieu label hoac aria-label",
    matches: (line) => /<input\b/i.test(line) && !/(aria-label|aria-labelledby|id\s*=)/.test(line),
  },
  {
    rule: "div-click",
    message: "<div onClick> can role va tabIndex de keyboard accessible",
    matches: (line) => /<div\b[^>]*onClick/i.test(line) && !/role\s*=|tabIndex/.test(line),
  },
];

/** Run accessibility heuristics on source files. */
export function checkA11y(repo: string): A11yResult {
  const allFiles = getAllSourceFiles(repo).filter((f) => /\.(tsx|jsx)$/.test(f));
  const issues: A11yIssue[] = [];

  for (const file of allFiles) {
    const content = readSafe(repo, file);
    if (!content) continue;

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      issues.push(...collectLineIssues(file, lines[i], i + 1));
    }
  }

  return {
    issueCount: issues.length,
    issues: issues.slice(0, 30),
    summary: summarizeA11y(issues, allFiles.length),
    scannedFiles: allFiles.length,
  };
}

function collectLineIssues(file: string, line: string, lineNumber: number): A11yIssue[] {
  return A11Y_LINE_RULES
    .filter((lineRule) => lineRule.matches(line))
    .map((lineRule) => ({ file, line: lineNumber, rule: lineRule.rule, message: lineRule.message }));
}

function summarizeA11y(issues: A11yIssue[], scannedFiles: number): string {
  if (issues.length === 0) return "Khong phat hien van de a11y co ban.";

  const topRule = Object.entries(groupByRule(issues)).sort((a, b) => b[1] - a[1])[0]?.[0];
  return "Phat hien " + issues.length + " van de a11y trong " + scannedFiles + " file. Loai pho bien: " + topRule;
}

function groupByRule(issues: A11yIssue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of issues) out[i.rule] = (out[i.rule] || 0) + 1;
  return out;
}
