/** Analysis handlers — circular_deps, dead_code, secret_scan, i18n_gap. */
import { resolveRepo } from "../../utils/pathGuard.js";
import { findCircularDeps, findDeadCode, scanSecrets, findI18nGap } from "../../utils/codeAnalysis.js";
import type { CircularDepsResult, DeadCodeResult, SecretScanResult, I18nGapResult } from "../../types.js";

/** Detect import cycles in the dependency graph. */
export async function handleCircularDeps(args: { repoPath?: string }): Promise<CircularDepsResult> {
  const repo = resolveRepo(args.repoPath);
  return findCircularDeps(repo);
}

/** Find unused exports and orphan files. */
export async function handleDeadCode(args: { repoPath?: string }): Promise<DeadCodeResult> {
  const repo = resolveRepo(args.repoPath);
  return findDeadCode(repo);
}

/** Scan repo for hardcoded secrets and credentials. */
export async function handleSecretScanV2(args: { repoPath?: string }): Promise<SecretScanResult> {
  const repo = resolveRepo(args.repoPath);
  return scanSecrets(repo);
}

/** Find missing translations against a base locale. */
export async function handleI18nGap(args: { repoPath?: string; baseLocale?: string }): Promise<I18nGapResult> {
  const repo = resolveRepo(args.repoPath);
  return findI18nGap(repo, args.baseLocale);
}
