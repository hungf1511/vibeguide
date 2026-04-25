/** Pre-deploy validation handler - kiem tra bug patterns, uncommitted changes, orphans, secrets. */
import type { DeployCheckResult, DeployCheck, DepGraph } from "../../types.js";
import { resolveRepo } from "../../utils/pathGuard.js";
import { getFileContent, getAllSourceFiles, getGitStatus } from "../../utils/scanner.js";
import { dirtyPaths } from "../../core/git/status.js";
import { matchPatterns } from "../../utils/heuristics.js";
import { loadConfig, detectFramework, type VibeguideConfig } from "../../utils/configLoader.js";
import { checkKnownVulnerabilities } from "../../utils/vulnerabilityScanner.js";
import { getCachedDeps } from "./impact.js";

/** Run deploy readiness sub-checks (env, build, test, secrets). */
export async function handleDeployCheck(args: { repoPath?: string; checkBugPatterns?: boolean; checkUncommitted?: boolean; checkOrphans?: boolean }): Promise<DeployCheckResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = await (getCachedDeps(repo));
  const allSourceFiles = getAllSourceFiles(repo);
  const config = loadConfig(repo);
  const checks: DeployCheck[] = [];

  if (args.checkBugPatterns !== false) checks.push(checkBugPatterns(repo, allSourceFiles));
  if (args.checkUncommitted !== false) checks.push(checkUncommitted(repo));
  if (args.checkOrphans !== false) checks.push(checkOrphans(deps));

  checks.push(checkSecrets(repo, allSourceFiles));
  checks.push(checkDependencyVulnerabilities(repo));
  checks.push(checkFramework(repo));

  const allPassed = checks.every((c) => c.passed);
  return { passed: allPassed, checks, summary: summarizeChecks(checks, config, allPassed) };
}

function checkBugPatterns(repo: string, allSourceFiles: string[]): DeployCheck {
  let bugCount = 0;
  let criticalCount = 0;

  for (const file of allSourceFiles) {
    const content = getFileContent(file, repo);
    if (!content) continue;

    for (const m of matchPatterns(content, file)) {
      bugCount++;
      if (m.pattern.severity === "critical") criticalCount++;
    }
  }

  return {
    name: "Bug Patterns",
    passed: criticalCount === 0 && bugCount <= 5,
    message: criticalCount > 0 ? `Phat hien ${criticalCount} loi critical!` : bugCount > 0 ? `Phat hien ${bugCount} bug pattern (khong co critical).` : "Khong phat hien bug pattern.",
    severity: criticalCount > 0 ? "critical" : bugCount > 0 ? "warning" : "info",
  };
}

function checkUncommitted(repo: string): DeployCheck {
  const status = getGitStatus(repo);
  if (!status.available) {
    return {
      name: "Uncommitted Changes",
      passed: false,
      message: `Khong kiem tra duoc git status: ${status.error ?? "git unavailable"}`,
      severity: "warning",
    };
  }
  const dirty = dirtyPaths(status);
  const hasUncommitted = dirty.length > 0;

  return {
    name: "Uncommitted Changes",
    passed: !hasUncommitted,
    message: hasUncommitted ? `Co ${dirty.length} file chua commit (bao gom staged/untracked) - nen commit truoc khi deploy.` : "Tat ca thay doi da commit.",
    severity: hasUncommitted ? "warning" : "info",
  };
}

function checkOrphans(deps: DepGraph): DeployCheck {
  const incoming = new Set<string>();
  const outgoing = new Set<string>();

  for (const edge of deps.edges) {
    incoming.add(edge.to);
    outgoing.add(edge.from);
  }

  const orphans = deps.nodes.filter((n) => !incoming.has(n) && !outgoing.has(n));
  return {
    name: "Orphaned Files",
    passed: orphans.length === 0,
    message: orphans.length > 0 ? `Phat hien ${orphans.length} file orphan (khong duoc import va khong import ai).` : "Khong co file orphan.",
    severity: orphans.length > 0 ? "warning" : "info",
  };
}

function checkSecrets(repo: string, allSourceFiles: string[]): DeployCheck {
  let secretCount = 0;
  const secretPattern = /(?<![A-Za-z0-9"'])(?:password|secret|token|api_key)\s*[:=]\s*["'][^"']{8,}["']/gi;

  for (const file of allSourceFiles) {
    const content = getFileContent(file, repo);
    if (!content) continue;

    const matches = content.match(secretPattern);
    if (matches) secretCount += matches.length;
  }

  return {
    name: "Hardcoded Secrets",
    passed: secretCount === 0,
    message: secretCount > 0 ? `Phat hien ${secretCount} hardcoded secret!` : "Khong phat hien hardcoded secret.",
    severity: secretCount > 0 ? "critical" : "info",
  };
}

function checkDependencyVulnerabilities(repo: string): DeployCheck {
  const vulns = checkKnownVulnerabilities(repo);
  const hasCritical = vulns.some((v) => v.severity === "critical");
  const hasHigh = vulns.some((v) => v.severity === "high");

  return {
    name: "Dependency Vulnerabilities",
    passed: vulns.length === 0,
    message: vulns.length > 0 ? `Phat hien ${vulns.length} lo hong dependency (${vulns.map((v) => v.package).join(", ")}).` : "Khong phat hien lo hong dependency nao.",
    severity: hasCritical ? "critical" : hasHigh ? "high" : vulns.length > 0 ? "warning" : "info",
  };
}

function checkFramework(repo: string): DeployCheck {
  const framework = detectFramework(repo);
  return {
    name: "Framework Detection",
    passed: true,
    message: `Phat hien framework: ${framework}.`,
    severity: "info",
  };
}

function summarizeChecks(checks: DeployCheck[], config: VibeguideConfig, allPassed: boolean): string {
  const severityValue: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  const blockThreshold = severityValue[config.severityThresholds.deployBlock] ?? 3;
  const blockedChecks = checks.filter((c) => !c.passed && severityValue[c.severity] >= blockThreshold);

  return blockedChecks.length > 0
    ? `KHONG NEN DEPLOY: ${blockedChecks.length} check ${config.severityThresholds.deployBlock} that bai.`
    : allPassed
      ? "Tat ca check pass - co the deploy."
      : `Co ${checks.filter((c) => !c.passed).length} check warning - review truoc khi deploy.`;
}
