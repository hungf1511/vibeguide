/** List source files using git ls-files, fallback to fs walk. */
import * as fs from "fs";
import * as path from "path";
import { runGit, isGitRepo } from "./runGit.js";
import { loadConfig, shouldIgnore } from "../../utils/configLoader.js";
import { getCacheSignature } from "./head.js";

const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".py", ".go", ".rs", ".java", ".kt", ".swift"]);
const IGNORE = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "cache", "coverage"]);

export interface FileScope {
  paths?: string[];
  since?: string;
  until?: string;
}

/** Normalize path separators to forward slashes */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Memoize isGitRepo to avoid spawning git process per call */
const gitRepoCache = new Map<string, boolean>();

function isGitRepoCached(dir: string): boolean {
  if (!gitRepoCache.has(dir)) {
    gitRepoCache.set(dir, isGitRepo(dir));
  }
  return gitRepoCache.get(dir)!;
}

/**
 * Per-process cache for lsFiles results.
 * Cache key includes repo signature so entries invalidate when HEAD or working tree changes.
 */
const lsFilesCache = new Map<string, string[]>();

/** List all source files — uses git ls-files when in a git repo, falls back to fs walk */
export function lsFiles(dir: string, scope?: FileScope): string[] {
  let signature = "";
  try {
    signature = getCacheSignature(dir);
  } catch {
    // non-git repo — cache by dir + scope only
  }
  const cacheKey = `${dir}:${signature}:${scope ? JSON.stringify(scope) : ""}`;
  if (lsFilesCache.has(cacheKey)) {
    return lsFilesCache.get(cacheKey)!;
  }
  const result = isGitRepoCached(dir) ? lsFilesGit(dir, scope) : lsFilesWalk(dir, scope);
  lsFilesCache.set(cacheKey, result);
  return result;
}

/** Use git ls-files -co --exclude-standard for tracked + untracked files */
function lsFilesGit(dir: string, scope?: FileScope): string[] {
  try {
    const output = scope?.since || scope?.until
      ? runScopedGitLog(dir, scope)
      : runGit(dir, ["ls-files", "-co", "--exclude-standard"]);
    const files = output.split("\n").filter(Boolean);
    const ignorePatterns = getConfiguredIgnorePatterns(dir);
    return filterSourceFiles(files, ignorePatterns, scope);
  } catch {
    return lsFilesWalk(dir, scope);
  }
}

/** Fallback fs walk (non-git repos) */
function lsFilesWalk(dir: string, scope?: FileScope): string[] {
  const files: string[] = [];
  const ignorePatterns = getConfiguredIgnorePatterns(dir);
  function walk(current: string, rel: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env") continue;
      if (IGNORE.has(entry.name)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (isIgnoredPath(childRel, ignorePatterns)) continue;
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), childRel);
      } else if (EXTS.has(path.extname(entry.name))) {
        files.push(normalizePath(childRel));
      }
    }
  }
  walk(dir, "");
  return filterSourceFiles(files, ignorePatterns, scope);
}

function runScopedGitLog(dir: string, scope: FileScope): string {
  const args = ["log", "--name-only", "--pretty=format:"];
  if (scope.since) args.push("--since", scope.since);
  if (scope.until) args.push("--until", scope.until);
  return runGit(dir, args);
}

function filterSourceFiles(files: string[], ignorePatterns: string[], scope?: FileScope): string[] {
  const seen = new Set<string>();
  const scopePaths = (scope?.paths || []).map(normalizePath).map((p) => p.replace(/\/$/, ""));
  for (const file of files.map(normalizePath)) {
    if (seen.has(file)) continue;
    if (!EXTS.has(path.extname(file))) continue;
    if (isDefaultIgnoredPath(file)) continue;
    if (isIgnoredPath(file, ignorePatterns)) continue;
    if (scopePaths.length > 0 && !scopePaths.some((p) => file === p || file.startsWith(`${p}/`))) continue;
    seen.add(file);
  }
  return [...seen].sort();
}

function isDefaultIgnoredPath(filePath: string): boolean {
  return normalizePath(filePath).split("/").some((part) => IGNORE.has(part));
}

function getConfiguredIgnorePatterns(dir: string): string[] {
  try {
    return loadConfig(dir).ignorePatterns;
  } catch {
    return [];
  }
}

function isIgnoredPath(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  return shouldIgnore(normalizePath(filePath), patterns);
}
