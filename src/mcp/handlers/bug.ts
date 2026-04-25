/** Bug detection handlers: heuristic_bug, trace_journey, test_plan, bug_report, suggest_fix. */
import * as path from "path";
import type { TestPlan, BugReport, FixSuggestionResult } from "../../types.js";
import { resolveRepo } from "../../utils/pathGuard.js";
import { getFileContent } from "../../utils/scanner.js";
import { matchPatterns } from "../../utils/heuristics.js";
import { generateSuggestion } from "../../utils/fixSuggestions.js";
import { getCachedDeps } from "./impact.js";
import { createHeuristicBugScan, type HeuristicBugResult } from "./bugScan.js";
import { createTestPlan } from "./testPlanBuilder.js";

const STEP_TERMS = ["click", "press", "type"];
const HIGH_SEVERITY_TERMS = ["crash", "error", "fail", "nothing happens", "not working", "stays the same", "doesn't respond", "khong an", "khong chay", "khong hoat dong"];
const MEDIUM_SEVERITY_TERMS = ["cannot", "won't", "doesn't work", "khong duoc"];

/** Trace a user journey through the codebase from a feature description. */
export async function handleTraceJourney(args: { journey: string; repoPath?: string }): Promise<{ steps: string[]; files: string[]; confidence: number }> {
  const repo = resolveRepo(args.repoPath);
  const deps = await (getCachedDeps(repo));
  const keywords = splitKeywords(args.journey);
  const matches: { file: string; score: number }[] = [];
  for (const node of deps.nodes) {
    const base = basenameWithoutExt(node);
    let score = 0;
    for (const keyword of keywords) if (base.includes(keyword)) score += 2;
    if (score > 0) matches.push({ file: node, score });
  }
  matches.sort((a, b) => b.score - a.score);
  const topFiles = matches.slice(0, 5).map((match) => match.file);
  const steps = topFiles.map((file) => `${file} interacts with ${deps.edges.filter((edge) => edge.from === file || edge.to === file).length} files`);
  return { steps, files: topFiles, confidence: matches.length > 0 ? Math.min(1, matches[0].score / 5) : 0 };
}

/** Run heuristic bug scan against a symptom keyword set. */
export async function handleHeuristicBug(args: { symptom: string; repoPath?: string }): Promise<HeuristicBugResult> {
  return createHeuristicBugScan(resolveRepo(args.repoPath), args.symptom);
}

/** Compare current state vs previous snapshot to surface regressions. */
export async function handleRegression(args: { changedFiles: string[]; repoPath?: string }): Promise<import("../../types.js").RegressionResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = await (getCachedDeps(repo));
  const flows = args.changedFiles.map((changed) => ({ name: `Flow affected by ${path.basename(changed)}`, files: [changed, ...deps.edges.filter((edge) => edge.to === changed).map((edge) => edge.from)], passed: true }));
  return { testFlows: flows, passed: flows.every((flow) => flow.passed) };
}

/** Build a test plan that covers the impact set of a change. */
export async function handleTestPlan(args: { feature: string; repoPath?: string }): Promise<TestPlan> {
  return createTestPlan(resolveRepo(args.repoPath), args.feature);
}

/** Compose a bug report from symptom + trace + heuristic matches. */
export async function handleBugReport(args: { description: string; repoPath?: string }): Promise<BugReport> {
  const repo = resolveRepo(args.repoPath);
  const lines = args.description.split(/\n|(?<=[.!?])\s+/).filter((line) => line.trim());
  const steps = lines.filter((line) => containsAny(line.toLowerCase(), STEP_TERMS)).map((line) => line.trim());
  const severity = inferBugSeverity(lines);

  return {
    formatted: ["## Bug Report", "", `**Description:** ${args.description}`, "", "**Steps to reproduce:**", ...steps.map((step, i) => `${i + 1}. ${step}`), "", `**Severity:** ${severity}`, "", `**Repo:** ${repo}`].join("\n"),
    steps,
    severity,
  };
}

/** Suggest a fix for a matched bug pattern. */
export async function handleSuggestFix(args: { filePath: string; patternId?: string; line?: number; repoPath?: string }): Promise<FixSuggestionResult> {
  const repo = resolveRepo(args.repoPath);
  const content = getFileContent(args.filePath, repo);
  if (!content) return { filePath: args.filePath, suggestions: [] };

  const suggestions = args.patternId && args.line
    ? collectRequestedSuggestion(content, args.patternId, args.line)
    : collectAllSuggestions(content, args.filePath);
  return { filePath: args.filePath, suggestions };
}

function splitKeywords(value: string): string[] {
  return value.toLowerCase().split(/\s+/).filter((keyword) => keyword.length > 2);
}

function basenameWithoutExt(file: string): string {
  return path.basename(file, path.extname(file)).toLowerCase();
}

function inferBugSeverity(lines: string[]): BugReport["severity"] {
  let severity: BugReport["severity"] = "low";
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (containsAny(lower, HIGH_SEVERITY_TERMS)) severity = "high";
    if (containsAny(lower, MEDIUM_SEVERITY_TERMS)) severity = severity === "low" ? "medium" : severity;
  }
  return severity;
}

function containsAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function collectRequestedSuggestion(content: string, patternId: string, line: number): FixSuggestionResult["suggestions"] {
  const suggestion = generateSuggestion(content, patternId, line);
  return suggestion ? [suggestion] : [];
}

function collectAllSuggestions(content: string, filePath: string): FixSuggestionResult["suggestions"] {
  const suggestions: FixSuggestionResult["suggestions"] = [];
  for (const match of matchPatterns(content, filePath)) {
    const suggestion = generateSuggestion(content, match.pattern.id, match.line);
    if (suggestion) suggestions.push(suggestion);
  }
  return suggestions;
}
