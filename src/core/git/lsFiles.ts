/** List source files using git ls-files, fallback to fs walk. */
import * as fs from "fs";
import * as path from "path";
import { runGit, isGitRepo } from "./runGit.js";
import { loadConfig, shouldIgnore } from "../../utils/configLoader.js";

const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".py", ".go", ".rs", ".java", ".kt", ".swift"]);
const IGNORE = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "cache", "coverage"]);

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
 * Safe because MCP server is stateless: each request spawns a fresh process,
 * and the repo does not change during a single request.
 */
const lsFilesCache = new Map<string, string[]>();

/** List all source files — uses git ls-files when in a git repo, falls back to fs walk */
export function lsFiles(dir: string): string[] {
  if (lsFilesCache.has(dir)) {
    return lsFilesCache.get(dir)!;
  }
  const result = isGitRepoCached(dir) ? lsFilesGit(dir) : lsFilesWalk(dir);
  lsFilesCache.set(dir, result);
  return result;
}

/** Use git ls-files -co --exclude-standard for tracked + untracked files */
function lsFilesGit(dir: string): string[] {
  try {
    const output = runGit(dir, ["ls-files", "-co", "--exclude-standard"]);
    const files = output.split("\n").filter(Boolean);
    const ignorePatterns = getConfiguredIgnorePatterns(dir);
    return files
      .filter((f) => EXTS.has(path.extname(f)))
      .filter((f) => !isIgnoredPath(f, ignorePatterns));
  } catch {
    return lsFilesWalk(dir);
  }
}

/** Fallback fs walk (non-git repos) */
function lsFilesWalk(dir: string): string[] {
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
        files.push(childRel);
      }
    }
  }
  walk(dir, "");
  return files;
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
