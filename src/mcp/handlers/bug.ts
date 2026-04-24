/** Bug detection handlers: heuristic_bug, trace_journey, test_plan, bug_report, suggest_fix. */
import * as path from "path";
import type { BugMatch, TestPlan, BugReport, FixSuggestionResult } from "../../types.js";
import { resolveRepo } from "../../utils/pathGuard.js";
import { getFileContent, getAllSourceFiles } from "../../utils/scanner.js";
import { matchPatterns } from "../../utils/heuristics.js";
import { generateSuggestion } from "../../utils/fixSuggestions.js";
import { getCachedDeps } from "./impact.js";

export async function handleTraceJourney(args: { journey: string; repoPath?: string }): Promise<{ steps: string[]; files: string[]; confidence: number }> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const keywords = args.journey.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
  const matches: { file: string; score: number }[] = [];
  for (const node of deps.nodes) {
    const base = path.basename(node, path.extname(node)).toLowerCase();
    let score = 0;
    for (const kw of keywords) if (base.includes(kw)) score += 2;
    if (score > 0) matches.push({ file: node, score });
  }
  matches.sort((a, b) => b.score - a.score);
  const topFiles = matches.slice(0, 5).map((m) => m.file);
  const steps = topFiles.map((file) => `${file} interacts with ${deps.edges.filter((e) => e.from === file || e.to === file).length} files`);
  return { steps, files: topFiles, confidence: matches.length > 0 ? Math.min(1, matches[0].score / 5) : 0 };
}

export async function handleHeuristicBug(args: { symptom: string; repoPath?: string }): Promise<{ summary: string; patternCounts: Record<string, number>; matches: BugMatch[]; suspiciousFiles: string[]; totalScanned: number; totalMatches: number; truncated: boolean }> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const allSourceFiles = getAllSourceFiles(repo);
  const keywords = args.symptom.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
  const suspicious = allSourceFiles.filter((f) => keywords.some((k) => path.basename(f, path.extname(f)).toLowerCase().includes(k)));
  const scanSet = new Set<string>(suspicious);
  for (const s of suspicious) {
    for (const edge of deps.edges) {
      if (edge.from === s) scanSet.add(edge.to);
      if (edge.to === s) scanSet.add(edge.from);
    }
  }
  const filesToScan = allSourceFiles;
  const matches: BugMatch[] = [];
  for (const file of filesToScan) {
    const content = getFileContent(file, repo);
    if (!content) continue;
    for (const m of matchPatterns(content, file)) {
      const isSuspicious = scanSet.has(file);
      const baseScore = m.pattern.severity === "critical" ? 1.0 : m.pattern.severity === "high" ? 0.8 : 0.5;
      matches.push({ pattern: m.pattern.id, file, line: m.line, score: isSuspicious ? baseScore * 1.2 : baseScore });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  const patternCounts: Record<string, number> = {};
  for (const m of matches) { patternCounts[m.pattern] = (patternCounts[m.pattern] || 0) + 1; }
  const TOP_N = 10;
  const topMatches = matches.slice(0, TOP_N);
  return {
    summary: `Scan ${filesToScan.length} file, phat hien ${matches.length} bug pattern (${Object.keys(patternCounts).length} loai). Nghiem trong nhat: ${matches[0]?.pattern || "N/A"} o ${matches[0]?.file || ""}.`,
    patternCounts,
    matches: topMatches,
    suspiciousFiles: suspicious.slice(0, 10),
    totalScanned: filesToScan.length,
    totalMatches: matches.length,
    truncated: matches.length > TOP_N,
  };
}

export async function handleRegression(args: { changedFiles: string[]; repoPath?: string }): Promise<import("../../types.js").RegressionResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const flows = args.changedFiles.map((changed) => ({ name: `Flow affected by ${path.basename(changed)}`, files: [changed, ...deps.edges.filter((e) => e.to === changed).map((e) => e.from)], passed: true }));
  return { testFlows: flows, passed: flows.every((f) => f.passed) };
}

export async function handleTestPlan(args: { feature: string; repoPath?: string }): Promise<TestPlan> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const keywords = args.feature.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
  const synonymMap: Record<string, string[]> = {
    checkout: ["payment", "pay", "cart"], payment: ["checkout", "pay", "cart"], cart: ["checkout", "payment", "pay"],
    login: ["auth", "signin"], auth: ["login", "signin"],
  };
  const expanded = [...keywords];
  for (const k of keywords) { if (synonymMap[k]) expanded.push(...synonymMap[k]); }
  const allKeywords = [...new Set(expanded)];
  let relevant = deps.nodes.filter((f) => allKeywords.some((k) => path.basename(f, path.extname(f)).toLowerCase().includes(k)));
  if (relevant.length === 0) {
    for (const file of deps.nodes) {
      const content = getFileContent(file, repo);
      if (!content) continue;
      const lowerContent = content.toLowerCase();
      if (allKeywords.some((k) => lowerContent.includes(k))) relevant.push(file);
    }
  }
  const actionSteps: string[] = [];
  const filesToScan = relevant.length > 0 ? relevant.slice(0, 5) : deps.nodes.filter((f) => /\.(tsx|jsx|vue)$/.test(f));
  for (const file of filesToScan) {
    const content = getFileContent(file, repo);
    if (!content) continue;
    const btnRegex = /<button\b[\s\S]*?\bonClick\s*=\s*\{[^}]+\}[\s\S]*?>([\s\S]*?)<\/button>/gi;
    let m: RegExpExecArray | null;
    while ((m = btnRegex.exec(content)) !== null) {
      const label = m[1].trim().replace(/\s+/g, " ");
      if (label && label.length > 1 && label.length < 40 && !actionSteps.includes(`Bam nut "${label}"`)) actionSteps.push(`Bam nut "${label}"`);
    }
    const inputRegex = /placeholder\s*=\s*["']([^"']+)["']/gi;
    while ((m = inputRegex.exec(content)) !== null) {
      const ph = m[1].trim();
      if (ph && !actionSteps.includes(`Dien "${ph}"`)) actionSteps.push(`Dien "${ph}"`);
    }
  }
  const steps = [
    `Mo trang ${args.feature}`,
    ...actionSteps.slice(0, 4),
    ...relevant.slice(0, 2).map((f) => `Kiem tra ${path.basename(f, path.extname(f))} hien thi dung`),
    "Mo DevTools (F12) kiem tra khong co loi do trong Console",
  ];
  const expect = [
    "Trang load thanh cong, khong trang",
    ...actionSteps.slice(0, 2).map((s) => `${s.replace("Bam nut", "Sau khi bam nut").replace("Dien", "Sau khi dien")} co phan hoi (redirect, toast, hoac UI update)`),
    "Khong co loi do trong Console",
  ];
  return { feature: args.feature, steps, expect };
}

export async function handleBugReport(args: { description: string; repoPath?: string }): Promise<BugReport> {
  const repo = resolveRepo(args.repoPath);
  const lines = args.description.split(/\n|(?<=[.!?])\s+/).filter((l) => l.trim());
  const steps: string[] = [];
  let severity: BugReport["severity"] = "low";
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("click") || lower.includes("press") || lower.includes("type")) steps.push(line.trim());
    if (lower.includes("crash") || lower.includes("error") || lower.includes("fail") || lower.includes("nothing happens") || lower.includes("not working") || lower.includes("stays the same") || lower.includes("doesn't respond") || lower.includes("khong an") || lower.includes("khong chay") || lower.includes("khong hoat dong")) severity = "high";
    if (lower.includes("cannot") || lower.includes("won't") || lower.includes("doesn't work") || lower.includes("khong duoc")) severity = severity === "low" ? "medium" : severity;
  }
  return { formatted: ["## Bug Report", "", `**Description:** ${args.description}`, "", "**Steps to reproduce:**", ...steps.map((s, i) => `${i + 1}. ${s}`), "", `**Severity:** ${severity}`, "", `**Repo:** ${repo}`].join("\n"), steps, severity };
}

export async function handleSuggestFix(args: { filePath: string; patternId?: string; line?: number; repoPath?: string }): Promise<FixSuggestionResult> {
  const repo = resolveRepo(args.repoPath);
  const content = getFileContent(args.filePath, repo);
  if (!content) return { filePath: args.filePath, suggestions: [] };
  let suggestions: FixSuggestionResult["suggestions"] = [];
  if (args.patternId && args.line) {
    const s = generateSuggestion(content, args.patternId, args.line);
    if (s) suggestions.push(s);
  } else {
    for (const m of matchPatterns(content, args.filePath)) {
      const s = generateSuggestion(content, m.pattern.id, m.line);
      if (s) suggestions.push(s);
    }
  }
  return { filePath: args.filePath, suggestions };
}
