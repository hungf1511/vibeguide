/** Pre-deploy validation handler — kiểm tra bug patterns, uncommitted changes, orphans, secrets. */
import * as path from "path";
import * as fs from "fs";
import type { DeployCheckResult, DeployCheck } from "../../types.js";
import { resolveRepo } from "../../utils/pathGuard.js";
import { getFileContent, getAllSourceFiles } from "../../utils/scanner.js";
import { matchPatterns } from "../../utils/heuristics.js";
import { loadConfig, detectFramework } from "../../utils/configLoader.js";
import { checkKnownVulnerabilities } from "../../utils/vulnerabilityScanner.js";
import { getCachedDeps } from "./impact.js";

export async function handleDeployCheck(args: { repoPath?: string; checkBugPatterns?: boolean; checkUncommitted?: boolean; checkOrphans?: boolean }): Promise<DeployCheckResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const allSourceFiles = getAllSourceFiles(repo);
  const config = loadConfig(repo);
  const checks: DeployCheck[] = [];

  if (args.checkBugPatterns !== false) {
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
    checks.push({
      name: "Bug Patterns",
      passed: criticalCount === 0 && bugCount <= 5,
      message: criticalCount > 0 ? `Phat hien ${criticalCount} loi critical!` : bugCount > 0 ? `Phat hien ${bugCount} bug pattern (khong co critical).` : "Khong phat hien bug pattern.",
      severity: criticalCount > 0 ? "critical" : bugCount > 0 ? "warning" : "info",
    });
  }

  if (args.checkUncommitted !== false) {
    let hasUncommitted = false;
    try {
      const { execSync } = await import("child_process");
      const output = execSync("git status --short", { cwd: repo, encoding: "utf-8" });
      hasUncommitted = output.trim().length > 0;
    } catch { /* Not a git repo */ }
    checks.push({
      name: "Uncommitted Changes",
      passed: !hasUncommitted,
      message: hasUncommitted ? "Co file chua commit - nen commit truoc khi deploy." : "Tat ca thay doi da commit.",
      severity: hasUncommitted ? "warning" : "info",
    });
  }

  if (args.checkOrphans !== false) {
    const incoming = new Set<string>();
    const outgoing = new Set<string>();
    for (const edge of deps.edges) {
      incoming.add(edge.to);
      outgoing.add(edge.from);
    }
    const orphans = deps.nodes.filter((n) => !incoming.has(n) && !outgoing.has(n));
    checks.push({
      name: "Orphaned Files",
      passed: orphans.length === 0,
      message: orphans.length > 0 ? `Phat hien ${orphans.length} file orphan (khong duoc import va khong import ai).` : "Khong co file orphan.",
      severity: orphans.length > 0 ? "warning" : "info",
    });
  }

  let secretCount = 0;
  for (const file of allSourceFiles) {
    const content = getFileContent(file, repo);
    if (!content) continue;
    const re = /(?<![A-Za-z0-9"'])(?:password|secret|token|api_key)\s*[:=]\s*["'][^"']{8,}["']/gi;
    const matches = content.match(re);
    if (matches) secretCount += matches.length;
  }
  checks.push({
    name: "Hardcoded Secrets",
    passed: secretCount === 0,
    message: secretCount > 0 ? `Phat hien ${secretCount} hardcoded secret!` : "Khong phat hien hardcoded secret.",
    severity: secretCount > 0 ? "critical" : "info",
  });

  const vulns = checkKnownVulnerabilities(repo);
  checks.push({
    name: "Dependency Vulnerabilities",
    passed: vulns.length === 0,
    message: vulns.length > 0 ? `Phat hien ${vulns.length} lo hong dependency (${vulns.map((v) => v.package).join(", ")}).` : "Khong phat hien lo hong dependency nao.",
    severity: vulns.some((v) => v.severity === "critical") ? "critical" : vulns.some((v) => v.severity === "high") ? "high" : vulns.length > 0 ? "warning" : "info",
  });

  const framework = detectFramework(repo);
  checks.push({
    name: "Framework Detection",
    passed: true,
    message: `Phat hien framework: ${framework}.`,
    severity: "info",
  });

  const severityValue: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  const blockThreshold = severityValue[config.severityThresholds.deployBlock] ?? 3;
  const blockedChecks = checks.filter((c) => !c.passed && severityValue[c.severity] >= blockThreshold);
  const allPassed = checks.every((c) => c.passed);
  const summary = blockedChecks.length > 0
    ? `KHONG NEN DEPLOY: ${blockedChecks.length} check ${config.severityThresholds.deployBlock} that bai.`
    : allPassed
      ? "Tat ca check pass - co the deploy."
      : `Co ${checks.filter((c) => !c.passed).length} check warning - review truoc khi deploy.`;

  return { passed: allPassed, checks, summary };
}
