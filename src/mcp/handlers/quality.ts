/** Quality handlers — type_check, test_coverage, complexity, a11y_check, doc_gap, perf_budget. */
import * as path from "path";
import { resolveRepo } from "../../utils/pathGuard.js";
import { runTypeCheck, getTestCoverage, analyzeComplexity, findDocGaps, checkPerfBudget } from "../../utils/qualityChecks.js";
import { checkA11y } from "../../utils/codeAnalysis.js";
import type { TypeCheckResult, TestCoverageResult, ComplexityResult, A11yResult, DocGapResult, PerfBudgetResult } from "../../types.js";

export async function handleTypeCheck(args: { repoPath?: string }): Promise<TypeCheckResult> {
  const repo = resolveRepo(args.repoPath);
  return runTypeCheck(repo);
}

export async function handleTestCoverage(args: { repoPath?: string }): Promise<TestCoverageResult> {
  const repo = resolveRepo(args.repoPath);
  return getTestCoverage(repo);
}

export async function handleComplexity(args: { repoPath?: string; thresholdLoc?: number; thresholdComplexity?: number }): Promise<ComplexityResult> {
  const repo = resolveRepo(args.repoPath);
  return analyzeComplexity(repo, { thresholdLoc: args.thresholdLoc, thresholdComplexity: args.thresholdComplexity });
}

export async function handleA11yCheck(args: { repoPath?: string }): Promise<A11yResult> {
  const repo = resolveRepo(args.repoPath);
  return checkA11y(repo);
}

export async function handleDocGap(args: { repoPath?: string }): Promise<DocGapResult> {
  const repo = resolveRepo(args.repoPath);
  return findDocGaps(repo);
}

export async function handlePerfBudget(args: { repoPath?: string; budgetKb?: number }): Promise<PerfBudgetResult> {
  const repo = resolveRepo(args.repoPath);
  return checkPerfBudget(repo, args.budgetKb);
}
