/** PR review handler — aggregates quality checks, bug scan, secret scan, circular deps, diff summary, impact, test plan. */
import { resolveRepo } from "../../utils/pathGuard.js";
import { runTypeCheck } from "../../utils/qualityChecks.js";
import { findCircularDeps, scanSecrets } from "../../utils/codeAnalysis.js";
import { handleHeuristicBug, handleTestPlan } from "./bug.js";
import { handleImpact } from "./impact.js";
import { handleDiffSummary } from "./repo.js";
import type { ReviewPrResult } from "../../types.js";

export async function handleReviewPr(args: { repoPath?: string; filePath?: string; feature?: string }): Promise<ReviewPrResult> {
  const repo = resolveRepo(args.repoPath);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const sections: ReviewPrResult["sections"] = [];

  // 1. TypeCheck
  const tc = runTypeCheck(repo);
  const typeStatus: ReviewPrResult["sections"][number]["status"] = tc.passed ? "ok" : tc.errorCount > 0 ? "block" : "warn";
  sections.push({
    name: "TypeScript",
    status: typeStatus,
    detail: tc.summary,
  });
  if (!tc.passed && tc.errorCount > 0) blockers.push("TypeScript: " + tc.errorCount + " lỗi compile");
  else if (!tc.passed) warnings.push("TypeScript: không chạy được compiler");

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
      detail: "Risk " + impact.risk + ", " + impact.affectedFiles.length + " file trực tiếp, " + impact.indirectFiles.length + " gián tiếp",
    });
  }

  // 7. Test plan (if feature provided)
  if (args.feature) {
    const plan = await handleTestPlan({ feature: args.feature, repoPath: repo });
    sections.push({
      name: "Test plan: " + args.feature,
      status: "ok",
      detail: plan.steps.length + " bước, " + plan.expect.length + " expect",
    });
  }

  const passed = blockers.length === 0;
  const summary = passed
    ? "PR sẵn sàng merge. " + warnings.length + " warning."
    : "PR có " + blockers.length + " blocker. Sửa trước khi merge.";

  const founderBrief = [
    "Tóm tắt PR cho Founder:",
    "- Trạng thái: " + (passed ? "Sẵn sàng merge" : "Cần sửa " + blockers.length + " lỗi"),
    "- Thay đổi: " + diff.totalFiles + " file (" + diff.summary + ")",
    args.feature ? "- Tính năng: " + args.feature : "",
    blockers.length > 0 ? "- Blocker: " + blockers.join("; ") : "",
    warnings.length > 0 ? "- Warning: " + warnings.join("; ") : "",
  ].filter(Boolean).join("\n");

  return { passed, blockers, warnings, sections, summary, founderBrief };
}
