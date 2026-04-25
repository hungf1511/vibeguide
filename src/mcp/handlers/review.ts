/** PR review handler - aggregates quality checks, bug scan, secret scan, circular deps, diff summary, impact, test plan. */
import { resolveRepo } from "../../utils/pathGuard.js";
import { runTypeCheck } from "../../utils/qualityChecks.js";
import { findCircularDeps, scanSecrets } from "../../utils/codeAnalysis.js";
import { handleHeuristicBug, handleTestPlan } from "./bug.js";
import { handleImpact } from "./impact.js";
import { handleDiffSummary } from "./snapshotDiff.js";
import type { ReviewPrResult } from "../../types.js";

type ReviewSection = ReviewPrResult["sections"][number];
type ReviewCheck = { section: ReviewSection; blockers?: string[]; warnings?: string[] };
type DiffSummary = Awaited<ReturnType<typeof handleDiffSummary>>;

/** Review a PR diff and surface risks. */
export async function handleReviewPr(args: { repoPath?: string; filePath?: string; feature?: string }): Promise<ReviewPrResult> {
  const repo = resolveRepo(args.repoPath);
  const bugCheck = await (reviewBugPatterns(repo).catch((error) => failedReviewCheck("Bug patterns", error)));
  const diff = await (reviewDiff(repo).catch((error) => failedDiffReview(error)));
  const checks: ReviewCheck[] = [
    reviewTypeScript(repo),
    bugCheck,
    reviewSecrets(repo),
    await (reviewCircularDeps(repo)),
    diff.check,
  ];

  if (args.filePath) checks.push(await (reviewImpact(repo, args.filePath).catch((error) => failedReviewCheck("Impact (" + args.filePath + ")", error))));
  if (args.feature) checks.push(await (reviewTestPlan(repo, args.feature).catch((error) => failedReviewCheck("Test plan: " + args.feature, error))));

  const blockers = checks.flatMap((check) => check.blockers ?? []);
  const warnings: string[] = [];
  const unavailableSections: string[] = [];
  for (const check of checks) {
    const checkWarnings = check.warnings ?? [];
    if (checkWarnings.length > 0) {
      warnings.push(...checkWarnings);
    } else if (check.section.status === "warn") {
      warnings.push(`${check.section.name}: ${check.section.detail ?? "warning"}`);
    }
    if (check.section.unavailable) {
      unavailableSections.push(check.section.name);
    }
  }
  const sections = checks.map((check) => check.section);
  const passed = blockers.length === 0 && unavailableSections.length === 0;

  return {
    passed,
    blockers,
    warnings,
    sections,
    summary: unavailableSections.length > 0
      ? `Can review thu cong — ${unavailableSections.length} section khong doc duoc: ${unavailableSections.join(", ")}.`
      : buildSummary(passed, blockers.length, warnings.length),
    founderBrief: buildFounderBrief(passed, blockers, warnings, unavailableSections, diff.summary, args.feature),
  };
}

function reviewTypeScript(repo: string): ReviewCheck {
  const tc = runTypeCheck(repo);
  const status: ReviewSection["status"] = tc.passed ? "ok" : tc.errorCount > 0 ? "block" : "warn";
  return {
    section: { name: "TypeScript", status, detail: tc.summary },
    blockers: !tc.passed && tc.errorCount > 0 ? ["TypeScript: " + tc.errorCount + " loi compile"] : [],
    warnings: !tc.passed && tc.errorCount === 0 ? ["TypeScript: khong chay duoc compiler"] : [],
  };
}

async function reviewBugPatterns(repo: string): Promise<ReviewCheck> {
  const bug = await handleHeuristicBug({ symptom: "potential issues", repoPath: repo });
  const critical = (bug.matches || []).filter((m) => m.score >= 1.0).length;
  return {
    section: {
      name: "Bug patterns",
      status: critical > 0 ? "block" : bug.totalMatches > 5 ? "warn" : "ok",
      detail: bug.summary,
    },
    blockers: critical > 0 ? ["Bug: " + critical + " critical pattern"] : [],
    warnings: critical === 0 && bug.totalMatches > 5 ? ["Bug: " + bug.totalMatches + " pattern"] : [],
  };
}

function reviewSecrets(repo: string): ReviewCheck {
  const secrets = scanSecrets(repo);
  const criticalSecrets = secrets.findings.filter((f) => f.severity === "critical").length;
  return {
    section: {
      name: "Secret scan",
      status: criticalSecrets > 0 ? "block" : secrets.findings.length > 0 ? "warn" : "ok",
      detail: secrets.summary,
    },
    blockers: criticalSecrets > 0 ? ["Secret: " + criticalSecrets + " critical"] : [],
  };
}

async function reviewCircularDeps(repo: string): Promise<ReviewCheck> {
  const circ = await (findCircularDeps(repo));
  return {
    section: {
      name: "Circular deps",
      status: circ.cycleCount > 0 ? "warn" : "ok",
      detail: circ.summary,
    },
    warnings: circ.cycleCount > 0 ? ["Circular: " + circ.cycleCount + " cycle"] : [],
  };
}

async function reviewDiff(repo: string): Promise<{ check: ReviewCheck; summary: DiffSummary }> {
  const summary = await handleDiffSummary({ repoPath: repo, since: "git" });
  const isUnavailable = summary.summary.startsWith("Khong kiem tra duoc diff");
  return {
    summary,
    check: {
      section: {
        name: "Changes",
        status: isUnavailable ? "warn" : summary.totalFiles > 20 ? "warn" : "ok",
        detail: summary.summary,
        unavailable: isUnavailable,
      },
      warnings: isUnavailable ? [summary.summary] : [],
    },
  };
}

async function reviewImpact(repo: string, filePath: string): Promise<ReviewCheck> {
  const impact = await handleImpact({ filePath, repoPath: repo, autoSnapshot: false });
  return {
    section: {
      name: "Impact (" + filePath + ")",
      status: impact.risk === "high" ? "warn" : "ok",
      detail: "Risk " + impact.risk + ", " + impact.affectedFiles.length + " file truc tiep, " + impact.indirectFiles.length + " gian tiep",
    },
  };
}

async function reviewTestPlan(repo: string, feature: string): Promise<ReviewCheck> {
  const plan = await handleTestPlan({ feature, repoPath: repo });
  return {
    section: {
      name: "Test plan: " + feature,
      status: "ok",
      detail: plan.steps.length + " buoc, " + plan.expect.length + " expect",
    },
  };
}

function buildSummary(passed: boolean, blockerCount: number, warningCount: number): string {
  return passed
    ? "PR san sang merge. " + warningCount + " warning."
    : "PR co " + blockerCount + " blocker. Sua truoc khi merge.";
}

function failedReviewCheck(name: string, error: unknown): ReviewCheck {
  return {
    section: { name, status: "warn", detail: "Khong chay duoc check: " + formatError(error) },
    warnings: [name + ": check failed"],
  };
}

function failedDiffReview(error: unknown): { check: ReviewCheck; summary: DiffSummary } {
  const summary: DiffSummary = { summary: "Khong doc duoc diff: " + formatError(error), filesChanged: [], riskAssessment: "Can review thu cong.", totalFiles: 0 };
  return { summary, check: { section: { name: "Changes", status: "warn", detail: summary.summary, unavailable: true }, warnings: ["Changes: diff failed"] } };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildFounderBrief(passed: boolean, blockers: string[], warnings: string[], unavailableSections: string[], diff: DiffSummary, feature?: string): string {
  let statusLine: string;
  if (unavailableSections.length > 0) {
    statusLine = "Can review thu cong vi khong doc duoc " + unavailableSections.join(", ");
  } else if (passed) {
    statusLine = "San sang merge";
  } else {
    statusLine = "Can sua " + blockers.length + " loi";
  }
  return [
    "Tom tat PR cho Founder:",
    "- Trang thai: " + statusLine,
    "- Thay doi: " + diff.totalFiles + " file (" + diff.summary + ")",
    feature ? "- Tinh nang: " + feature : "",
    blockers.length > 0 ? "- Blocker: " + blockers.join("; ") : "",
    warnings.length > 0 ? "- Warning: " + warnings.join("; ") : "",
  ].filter(Boolean).join("\n");
}
