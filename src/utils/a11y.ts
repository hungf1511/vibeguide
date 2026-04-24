/** Quét lỗi tiếp cận cơ bản (alt, aria-label, href, label) trong JSX/TSX. */
import type { A11yResult, A11yIssue } from "../types.js";
import { getAllSourceFiles } from "./scanner.js";
import { readSafe } from "./readSafe.js";

export function checkA11y(repo: string): A11yResult {
  const allFiles = getAllSourceFiles(repo).filter((f) => /\.(tsx|jsx)$/.test(f));
  const issues: A11yIssue[] = [];

  for (const file of allFiles) {
    const content = readSafe(repo, file);
    if (!content) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/<img\b/i.test(line) && !/\balt\s*=/.test(line)) {
        issues.push({ file, line: i + 1, rule: "img-alt", message: "Tag <img> thieu thuoc tinh alt" });
      }
      const btnMatch = /<button\b([^>]*)>([\s\S]*?)<\/button>/i.exec(line);
      if (btnMatch && !/aria-label/.test(btnMatch[1]) && !btnMatch[2].trim()) {
        issues.push({ file, line: i + 1, rule: "button-name", message: "Button khong co text hoac aria-label" });
      }
      if (/<a\b[^>]*onClick/i.test(line) && !/href\s*=/.test(line)) {
        issues.push({ file, line: i + 1, rule: "anchor-href", message: "<a onClick> can co href - dung <button> thay the" });
      }
      if (/<input\b/i.test(line) && !/(aria-label|aria-labelledby|id\s*=)/.test(line)) {
        issues.push({ file, line: i + 1, rule: "input-label", message: "<input> thieu label hoac aria-label" });
      }
      if (/<div\b[^>]*onClick/i.test(line) && !/role\s*=|tabIndex/.test(line)) {
        issues.push({ file, line: i + 1, rule: "div-click", message: "<div onClick> can role va tabIndex de keyboard accessible" });
      }
    }
  }

  const summary = issues.length === 0
    ? "Khong phat hien van de a11y co ban."
    : "Phat hien " + issues.length + " van de a11y trong " + allFiles.length + " file. Loai pho bien: " + Object.entries(groupByRule(issues)).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    issueCount: issues.length,
    issues: issues.slice(0, 30),
    summary,
    scannedFiles: allFiles.length,
  };
}

function groupByRule(issues: A11yIssue[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of issues) out[i.rule] = (out[i.rule] || 0) + 1;
  return out;
}
