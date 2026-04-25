/** Repo scanner: file tree, dependency graph, git status, path normalization. */
import * as fs from "fs";
import * as path from "path";
import type { DepEdge, DepGraph, TreeNode } from "../types.js";
import { getCacheSignature, getLog, getWorkingStatus, lsFiles } from "../core/git/index.js";
import type { FileScope } from "../core/git/index.js";
import { createSourceFile, getAnalyzerForFile } from "../analyzers/registry.js";
import { loadGoModule, loadPathAliases, resolveImportSpecifier } from "../analyzers/resolution.js";
import { loadConfig, shouldIgnore } from "./configLoader.js";

const IGNORE = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "cache", "coverage"]);

/** Convert any path separator to forward slash for cross-platform consistency. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Enumerate all source files in a repo. */
export function getAllSourceFiles(dir: string, scope?: FileScope): string[] {
  return lsFiles(dir, scope);
}

/** Compute a hash signature for repo state. */
export function getRepoSignature(dir: string): string {
  return getCacheSignature(dir);
}

/** Recursively scan a directory for source files. */
export function scanDirectory(dir: string): TreeNode[] {
  const ignorePatterns = getConfiguredIgnorePatterns(dir);

  function walk(current: string, rel: string): TreeNode[] {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return [];
    }

    const items: TreeNode[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env") continue;
      if (IGNORE.has(entry.name)) continue;

      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (isIgnoredPath(childRel, ignorePatterns)) continue;
      if (!entry.isDirectory()) {
        items.push({ name: entry.name, type: "file", path: childRel });
        continue;
      }

      items.push({
        name: entry.name,
        type: "folder",
        path: childRel,
        children: walk(path.join(current, entry.name), childRel),
      });
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
  return patterns.length > 0 && shouldIgnore(normalizePath(filePath), patterns);
}

/** Scan dependencies across all source files. */
export async function scanDependencies(dir: string, scope?: FileScope): Promise<DepGraph> {
  const edges: DepEdge[] = [];
  const fileSet = new Set<string>(getAllSourceFiles(dir, scope));
  const config = loadConfig(dir);
  const analyzerOptions = {
    backend: readParserBackend(config.parser.backend),
    legacyParser: config.parser.legacyParser || process.env.VIBEGUIDE_LEGACY_PARSER === "1",
  };
  const aliases = loadPathAliases(dir);
  const goModule = loadGoModule(dir);

  for (const file of fileSet) {
    const fullPath = path.join(dir, file);
    const content = readTextFile(fullPath);
    if (content === null) continue;

    const analyzer = getAnalyzerForFile(file, content, analyzerOptions);
    if (!analyzer) continue;
    const sourceFile = createSourceFile(dir, file, content);
    const imports = await analyzer.parseImports(sourceFile);
    for (const importRef of imports) {
      const resolved = resolveImportSpecifier(file, importRef.specifier, aliases, dir, {
        language: analyzer.language,
        goModule,
      });
      if (resolved && fileSet.has(resolved)) {
        edges.push({ from: file, to: resolved });
      }
    }
  }

  return { nodes: Array.from(fileSet), edges };
}

function readParserBackend(value: "static" | "tree-sitter"): "static" | "tree-sitter" {
  const envValue = process.env.VIBEGUIDE_PARSER_BACKEND;
  return envValue === "tree-sitter" || envValue === "static" ? envValue : value;
}

function readTextFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/** Read file content with safe path guard. */
export function getFileContent(filePath: string, repoPath: string): string | null {
  return readTextFile(path.join(repoPath, filePath));
}

/** Return working tree status as structured data. */
export function getGitStatus(repoPath: string) {
  return getWorkingStatus(repoPath);
}

/** Return recent commits with metadata. */
export function getRecentCommits(repoPath: string, count = 5): string[] {
  return getLog(repoPath, count).map((commit) => `${commit.shortSha} ${commit.message}`);
}
