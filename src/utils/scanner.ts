/** Repo scanner — liệt kê file, dependency graph, git status, path normalization. */
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import type { TreeNode, DepGraph, DepEdge } from "../types.js";
import { loadConfig, shouldIgnore } from "./configLoader.js";
import { lsFiles, getCacheSignature, normalizePath as gitNormalizePath } from "../core/git/index.js";

const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".py", ".go", ".rs"]);
const IGNORE = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "cache", "coverage"]);

/** Convert any path separator to forward slash for cross-platform consistency */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * List ALL source files matching EXTS in repo.
 * Uses git ls-files when in a git repo (fast, respects .gitignore), falls back to fs walk.
 */
export function getAllSourceFiles(dir: string): string[] {
  return lsFiles(dir);
}

/**
 * Compute a stable cache signature for the repo.
 * Content-addressed via git rev-parse HEAD — changing branches does NOT invalidate.
 * Falls back to mtime-based for non-git repos.
 */
export function getRepoSignature(dir: string): string {
  return getCacheSignature(dir);
}

export function scanDirectory(dir: string): TreeNode[] {
  const ignorePatterns = getConfiguredIgnorePatterns(dir);

  function walk(current: string, rel: string): TreeNode[] {
    const items: TreeNode[] = [];
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return items;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env") continue;
      if (IGNORE.has(entry.name)) continue;

      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (isIgnoredPath(childRel, ignorePatterns)) continue;
      if (entry.isDirectory()) {
        const children = walk(path.join(current, entry.name), childRel);
        items.push({ name: entry.name, type: "folder", path: childRel, children });
      } else {
        items.push({ name: entry.name, type: "file", path: childRel });
      }
    }

    return items;
  }

  return walk(dir, "");
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

export function scanDependencies(dir: string): DepGraph {
  const edges: DepEdge[] = [];
  const fileSet = new Set<string>(getAllSourceFiles(dir));
  const nodes: string[] = Array.from(fileSet);

  // Load path aliases from tsconfig.json / jsconfig.json
  const aliases = loadPathAliases(dir);

  for (const file of fileSet) {
    const fullPath = path.join(dir, file);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    // Match: static import, require, dynamic import, re-export
    const importRegex = /(?:import\s+(?:.*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)|from\s+["']([^"']+)["']|export\s+(?:\*\s+from\s+|{[^}]*}\s+from\s+)["']([^"']+)["'])/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const imported = match[1] || match[2] || match[3] || match[4] || match[5];
      if (!imported) continue;

      // Skip node_modules / external packages
      if (!imported.startsWith(".") && !aliases.some((a) => imported.startsWith(a.prefix))) continue;

      let resolved: string | null;

      if (imported.startsWith(".")) {
        resolved = resolveImport(file, imported, dir);
      } else {
        // Path alias: @/components/Button → src/components/Button
        resolved = resolveAliasImport(imported, aliases, dir);
      }

      if (resolved && fileSet.has(resolved)) {
        edges.push({ from: file, to: resolved });
      }
    }
  }

  return { nodes, edges };
}

function resolveImport(fromFile: string, importPath: string, baseDir: string): string | null {
  const fromDir = path.dirname(path.join(baseDir, fromFile));
  // ESM TypeScript: import "./tools.js" → file is actually "./tools.ts"
  let normalizedPath = importPath;
  const jsExtensions = [".js", ".jsx", ".mjs", ".cjs"];
  for (const ext of jsExtensions) {
    if (normalizedPath.endsWith(ext)) {
      normalizedPath = normalizedPath.slice(0, -ext.length);
      break;
    }
  }
  let resolved = path.resolve(fromDir, normalizedPath);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return path.relative(baseDir, resolved).replace(/\\/g, "/");
  }

  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".vue"]) {
    const withExt = resolved + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return path.relative(baseDir, withExt).replace(/\\/g, "/");
    }
  }

  // Barrel: import from "./utils" → resolve to utils/index.ts
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    for (const indexFile of ["index.ts", "index.tsx", "index.js", "index.jsx"]) {
      const indexPath = path.join(resolved, indexFile);
      if (fs.existsSync(indexPath)) {
        return path.relative(baseDir, indexPath).replace(/\\/g, "/");
      }
    }
  }

  return null;
}

interface PathAlias { prefix: string; target: string }

function loadPathAliases(dir: string): PathAlias[] {
  const aliases: PathAlias[] = [];
  for (const configFile of ["tsconfig.json", "jsconfig.json"]) {
    const configPath = path.join(dir, configFile);
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const paths = config?.compilerOptions?.paths;
      const baseUrl = config?.compilerOptions?.baseUrl || ".";
      if (!paths) continue;
      for (const [pattern, targets] of Object.entries(paths) as [string, string[]][]) {
        const prefix = pattern.replace(/\/\*$/, "");
        const target = (targets[0] || "").replace(/\/\*$/, "").replace(/^\.\//, "");
        if (prefix && target) {
          aliases.push({ prefix, target: path.join(baseUrl, target).replace(/\\/g, "/") });
        }
      }
    } catch {
      // No config file or invalid JSON
    }
  }
  return aliases;
}

function resolveAliasImport(imported: string, aliases: PathAlias[], baseDir: string): string | null {
  for (const alias of aliases) {
    if (!imported.startsWith(alias.prefix)) continue;
    const relative = imported.slice(alias.prefix.length).replace(/^\//, "");
    const targetPath = path.join(baseDir, alias.target, relative);
    return resolveImport("", targetPath.replace(/\\/g, "/"), baseDir);
  }
  return null;
}

export function getFileContent(filePath: string, repoPath: string): string | null {
  const fullPath = path.join(repoPath, filePath);
  try {
    return fs.readFileSync(fullPath, "utf-8");
  } catch {
    return null;
  }
}

export function getGitStatus(repoPath: string) {
  const status: { branch: string; modified: string[]; ahead: number } = {
    branch: "unknown",
    modified: [],
    ahead: 0,
  };

  try {
    const output = runGit(repoPath, ["status", "--short", "--branch"]);
    for (const line of output.split("\n").filter(Boolean)) {
      if (line.startsWith("## ")) {
        const branchInfo = line.slice(3).trim();
        const branchName = branchInfo.split("...")[0].split(" ")[0];
        if (branchName) status.branch = branchName;
        const aheadMatch = branchInfo.match(/ahead (\d+)/);
        if (aheadMatch) status.ahead = parseInt(aheadMatch[1], 10);
        continue;
      }

      const filePart = line.slice(3).trim();
      const renamedTarget = filePart.includes(" -> ") ? filePart.split(" -> ").pop() : filePart;
      if (renamedTarget) status.modified.push(normalizePath(renamedTarget));
    }
    return status;
  } catch {
    // Fall back to reading HEAD below for repos where git is not available.
  }

  try {
    const head = fs.readFileSync(path.join(repoPath, ".git", "HEAD"), "utf-8").trim();
    if (head.startsWith("ref: ")) {
      status.branch = head.replace("ref: refs/heads/", "");
    }
  } catch {
    // Not a git repo or no HEAD
  }

  return status;
}

export function getRecentCommits(repoPath: string, count = 5): string[] {
  try {
    const output = runGit(repoPath, ["log", "--oneline", `-${count}`]);
    return output.split("\n").filter(Boolean);
  } catch {
    return getRecentCommitsFromReflog(repoPath, count);
  }
}

function getRecentCommitsFromReflog(repoPath: string, count: number): string[] {
  try {
    const logsPath = path.join(repoPath, ".git", "logs", "HEAD");
    const seen = new Set<string>();
    const lines = fs.readFileSync(logsPath, "utf-8").split("\n").filter(Boolean).reverse();
    const commits: string[] = [];

    for (const line of lines) {
      const parts = line.split("\t");
      if (parts.length < 2) continue;
      const meta = parts[0].split(" ");
      const hash = meta[1]?.slice(0, 7);
      const message = parts.slice(1).join("\t").replace(/^commit(?: \(initial\))?:\s*/i, "").trim();
      if (!hash || seen.has(hash) || !message) continue;
      seen.add(hash);
      commits.push(`${hash} ${message}`);
      if (commits.length >= count) break;
    }

    return commits;
  } catch {
    return [];
  }
}

function runGit(repoPath: string, args: string[]): string {
  const safeRepo = normalizePath(path.resolve(repoPath));
  return execFileSync("git", ["-c", `safe.directory=${safeRepo}`, ...args], {
    cwd: repoPath,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}
