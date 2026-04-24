/** Quality & compliance handlers (14 tools) — type_check, coverage, circular_deps, dead_code, complexity, a11y, secret_scan, i18n_gap, doc_gap, perf_budget, monorepo_route, review_pr, founder_brief, meeting_notes. */
import * as path from "path";
import { resolveRepo } from "../../utils/pathGuard.js";
import { runTypeCheck, getTestCoverage, analyzeComplexity, findDocGaps, checkPerfBudget } from "../../utils/qualityChecks.js";
import { findCircularDeps, findDeadCode, checkA11y, scanSecrets, findI18nGap } from "../../utils/codeAnalysis.js";
import { analyzeMonorepo } from "../../utils/monorepo.js";
import { handleHeuristicBug, handleTestPlan } from "./bug.js";
import { handleImpact } from "./impact.js";
import { handleDeployCheck } from "./deploy.js";
import { handleDiffSummary } from "./repo.js";
import { getSession, getTimeline, generateProgressSummary } from "../../utils/sessionContext.js";
import { generateChangelog } from "../../utils/changelog.js";
import { getGitStatus } from "../../utils/scanner.js";
import type {
  TypeCheckResult,
  TestCoverageResult,
  CircularDepsResult,
  DeadCodeResult,
  ComplexityResult,
  A11yResult,
  SecretScanResult,
  I18nGapResult,
  DocGapResult,
  PerfBudgetResult,
  MonorepoRouteResult,
  ReviewPrResult,
  FounderBriefResult,
  MeetingNotesResult,
} from "../../types.js";

export async function handleTypeCheck(args: { repoPath?: string }): Promise<TypeCheckResult> {
  const repo = resolveRepo(args.repoPath);
  return runTypeCheck(repo);
}

export async function handleTestCoverage(args: { repoPath?: string }): Promise<TestCoverageResult> {
  const repo = resolveRepo(args.repoPath);
  return getTestCoverage(repo);
}

export async function handleCircularDeps(args: { repoPath?: string }): Promise<CircularDepsResult> {
  const repo = resolveRepo(args.repoPath);
  return findCircularDeps(repo);
}

export async function handleDeadCode(args: { repoPath?: string }): Promise<DeadCodeResult> {
  const repo = resolveRepo(args.repoPath);
  return findDeadCode(repo);
}

export async function handleComplexity(args: { repoPath?: string; thresholdLoc?: number; thresholdComplexity?: number }): Promise<ComplexityResult> {
  const repo = resolveRepo(args.repoPath);
  return analyzeComplexity(repo, { thresholdLoc: args.thresholdLoc, thresholdComplexity: args.thresholdComplexity });
}

export async function handleA11yCheck(args: { repoPath?: string }): Promise<A11yResult> {
  const repo = resolveRepo(args.repoPath);
  return checkA11y(repo);
}

export async function handleSecretScanV2(args: { repoPath?: string }): Promise<SecretScanResult> {
  const repo = resolveRepo(args.repoPath);
  return scanSecrets(repo);
}

export async function handleI18nGap(args: { repoPath?: string; baseLocale?: string }): Promise<I18nGapResult> {
  const repo = resolveRepo(args.repoPath);
  return findI18nGap(repo, args.baseLocale);
}

export async function handleDocGap(args: { repoPath?: string }): Promise<DocGapResult> {
  const repo = resolveRepo(args.repoPath);
  return findDocGaps(repo);
}

export async function handlePerfBudget(args: { repoPath?: string; budgetKb?: number }): Promise<PerfBudgetResult> {
  const repo = resolveRepo(args.repoPath);
  return checkPerfBudget(repo, args.budgetKb);
}

export async function handleMonorepoRoute(args: { repoPath?: string; changedFiles?: string[] }): Promise<MonorepoRouteResult> {
  const repo = resolveRepo(args.repoPath);
  return analyzeMonorepo(repo, args.changedFiles || []);
}

export async function handleReviewPr(args: { repoPath?: string; filePath?: string; feature?: string }): Promise<ReviewPrResult> {
  const repo = resolveRepo(args.repoPath);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const sections: ReviewPrResult["sections"] = [];

  // 1. TypeCheck
  const tc = runTypeCheck(repo);
  sections.push({
    name: "TypeScript",
    status: tc.passed ? "ok" : "block",
    detail: tc.summary,
  });
  if (!tc.passed) blockers.push("TypeScript: " + tc.errorCount + " loi compile");

  // 2. Heuristic bugs
  const bug = await handleHeuristicBug({ symptom: "potential issues", repoPath: repo });
  const critical = (bug.matches || []).filter((m) => m.score >= 1.0).length;
  sections.push({
    name: "Bug patterns",
    status: critical > 0 ? "block" : bug.totalMatches > 5 ? "warn" : "ok",
    detail: bug.summary,
  });
  if (critical > 0) blockers.push("Bug: " + critical + " critical pattern");
  else if (bug.totalMatches > 5) warnings.push("Bug: " + bug.totalMatches + " pattern");

  // 3. Secret scan
  const secrets = scanSecrets(repo);
  const criticalSecrets = secrets.findings.filter((f) => f.severity === "critical").length;
  sections.push({
    name: "Secret scan",
    status: criticalSecrets > 0 ? "block" : secrets.findings.length > 0 ? "warn" : "ok",
    detail: secrets.summary,
  });
  if (criticalSecrets > 0) blockers.push("Secret: " + criticalSecrets + " critical");

  // 4. Circular deps
  const circ = findCircularDeps(repo);
  sections.push({
    name: "Circular deps",
    status: circ.cycleCount > 0 ? "warn" : "ok",
    detail: circ.summary,
  });
  if (circ.cycleCount > 0) warnings.push("Circular: " + circ.cycleCount + " cycle");

  // 5. Diff summary
  const diff = await handleDiffSummary({ repoPath: repo, since: "git" });
  sections.push({
    name: "Changes",
    status: diff.totalFiles > 20 ? "warn" : "ok",
    detail: diff.summary,
  });

  // 6. Impact (if filePath provided)
  if (args.filePath) {
    const impact = await handleImpact({ filePath: args.filePath, repoPath: repo });
    sections.push({
      name: "Impact (" + args.filePath + ")",
      status: impact.risk === "high" ? "warn" : "ok",
      detail: "Risk " + impact.risk + ", " + impact.affectedFiles.length + " file truc tiep, " + impact.indirectFiles.length + " gian tiep",
    });
  }

  // 7. Test plan (if feature provided)
  if (args.feature) {
    const plan = await handleTestPlan({ feature: args.feature, repoPath: repo });
    sections.push({
      name: "Test plan: " + args.feature,
      status: "ok",
      detail: plan.steps.length + " buoc, " + plan.expect.length + " expect",
    });
  }

  const passed = blockers.length === 0;
  const summary = passed
    ? "PR san sang merge. " + warnings.length + " warning."
    : "PR co " + blockers.length + " blocker. Sua truoc khi merge.";

  const founderBrief = [
    "Tom tat PR cho Founder:",
    "- Trang thai: " + (passed ? "San sang merge" : "Can sua " + blockers.length + " loi"),
    "- Thay doi: " + diff.totalFiles + " file (" + diff.summary + ")",
    args.feature ? "- Tinh nang: " + args.feature : "",
    blockers.length > 0 ? "- Blocker: " + blockers.join("; ") : "",
    warnings.length > 0 ? "- Warning: " + warnings.join("; ") : "",
  ].filter(Boolean).join("\n");

  return { passed, blockers, warnings, sections, summary, founderBrief };
}

export async function handleFounderBrief(args: { repoPath?: string; days?: number }): Promise<FounderBriefResult> {
  const repo = resolveRepo(args.repoPath);
  const days = args.days ?? 7;
  const ctx = getSession(repo);
  const changelog = generateChangelog(repo, days * 5);

  const highlights: string[] = [];
  for (const section of changelog.sections) {
    if (section.title === "Tinh nang moi" || section.title === "Tính năng mới") {
      highlights.push(...section.items.slice(0, 3).map((i) => "Tinh nang moi: " + i));
    }
    if (section.title === "Sua loi" || section.title === "Sửa lỗi") {
      highlights.push(...section.items.slice(0, 2).map((i) => "Sua loi: " + i));
    }
  }

  const recentEvents = ctx.events.slice(-20);
  const toolCounts: Record<string, number> = {};
  for (const e of recentEvents) toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
  const mostUsed = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const nextSteps: string[] = [];
  if (ctx.status === "fixing") nextSteps.push("Tiep tuc sua loi dang xu ly");
  if (ctx.status === "testing") nextSteps.push("Hoan tat test cac buoc con lai");
  if (ctx.status === "deploying") nextSteps.push("Kiem tra deploy_check truoc khi day production");
  if (ctx.filesChanged.length > 0 && !ctx.snapshotId) nextSteps.push("Tao snapshot truoc khi deploy");

  const brief = [
    "# Bao cao tuan (" + days + " ngay)",
    "",
    "## Diem noi bat",
    ...(highlights.length > 0 ? highlights.map((h) => "- " + h) : ["- Khong co commit moi trong " + days + " ngay"]),
    "",
    "## Hoat dong",
    "- Ton " + recentEvents.length + " action trong session hien tai",
    mostUsed.length > 0 ? "- Tool dung nhieu: " + mostUsed.map(([n, c]) => n + " (" + c + ")").join(", ") : "",
    "- Trang thai: " + ctx.status,
    "",
    "## Buoc tiep theo",
    ...(nextSteps.length > 0 ? nextSteps.map((s) => "- " + s) : ["- Khong co viec dang lo"]),
  ].filter(Boolean).join("\n");

  return { brief, highlights, nextSteps };
}

export async function handleMeetingNotes(args: { repoPath?: string }): Promise<MeetingNotesResult> {
  const repo = resolveRepo(args.repoPath);
  const ctx = getSession(repo);
  const status = getGitStatus(repo);

  const done: string[] = [];
  const inProgress: string[] = [];
  const blockers: string[] = [];

  for (const decision of ctx.founderDecisions) {
    if (decision.type === "approve") done.push("Founder duyet: " + decision.note);
    if (decision.type === "rollback") blockers.push("Da rollback: " + decision.note);
    if (decision.type === "reject") blockers.push("Founder tu choi: " + decision.note);
  }

  for (const test of ctx.testResults) {
    if (test.passed) done.push("Test buoc " + test.step + " pass: " + test.note);
    else blockers.push("Test buoc " + test.step + " fail: " + test.note);
  }

  if (ctx.status === "fixing") inProgress.push("Dang sua loi");
  if (ctx.status === "testing") inProgress.push("Dang test");
  if (ctx.status === "deploying") inProgress.push("Dang deploy");
  if (ctx.status === "analyzing") inProgress.push("Dang phan tich impact");

  if (status.modified.length > 0) inProgress.push(status.modified.length + " file dang sua chua commit");

  const notes = [
    "# Bien ban hop",
    "",
    "Repo: " + ctx.repo,
    "Bat dau session: " + ctx.startedAt,
    "Trang thai: " + ctx.status,
    "",
    "## Da xong",
    ...(done.length > 0 ? done.map((d) => "- " + d) : ["- (chua ghi nhan)"]),
    "",
    "## Dang lam",
    ...(inProgress.length > 0 ? inProgress.map((d) => "- " + d) : ["- (khong co)"]),
    "",
    "## Blocker",
    ...(blockers.length > 0 ? blockers.map((d) => "- " + d) : ["- (khong co)"]),
  ].join("\n");

  return { done, inProgress, blockers, notes };
}