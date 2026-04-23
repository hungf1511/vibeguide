import * as fs from "fs";
import * as path from "path";
import type { TreeNode, DepGraph, DepEdge } from "../types.js";

const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".vue", ".py", ".go", ".rs"]);
const IGNORE = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "coverage"]);

export function scanDirectory(dir: string): TreeNode[] {
  const result: TreeNode[] = [];

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

export function scanDependencies(dir: string): DepGraph {
  const nodes: string[] = [];
  const edges: DepEdge[] = [];
  const fileSet = new Set<string>();

  function collectFiles(current: string, rel: string) {
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
      if (entry.isDirectory()) {
        collectFiles(path.join(current, entry.name), childRel);
      } else if (EXTS.has(path.extname(entry.name))) {
        fileSet.add(childRel);
      }
    }
  }

  collectFiles(dir, "");
  nodes.push(...fileSet);

  for (const file of fileSet) {
    const fullPath = path.join(dir, file);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    // Find import/require statements
    const importRegex = /(?:import\s+(?:.*?\s+from\s+)?["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)|from\s+["']([^"']+)["'])/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const imported = match[1] || match[2] || match[3];
      if (!imported) continue;
      if (imported.startsWith(".")) {
        const resolved = resolveImport(file, imported, dir);
        if (resolved && fileSet.has(resolved)) {
          edges.push({ from: file, to: resolved });
        }
      }
    }
  }

  return { nodes, edges };
}

function resolveImport(fromFile: string, importPath: string, baseDir: string): string | null {
  const fromDir = path.dirname(path.join(baseDir, fromFile));
  let resolved = path.resolve(fromDir, importPath);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return path.relative(baseDir, resolved).replace(/\\/g, "/");
  }

  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".vue", ".py", ".go", ".rs"]) {
    const withExt = resolved + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return path.relative(baseDir, withExt).replace(/\\/g, "/");
    }
  }

  const indexPath = path.join(resolved, "index.ts");
  if (fs.existsSync(indexPath)) {
    return path.relative(baseDir, indexPath).replace(/\\/g, "/");
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
    const head = fs.readFileSync(path.join(repoPath, ".git", "HEAD"), "utf-8").trim();
    if (head.startsWith("ref: ")) {
      status.branch = head.replace("ref: refs/heads/", "");
    }
  } catch {
    // Not a git repo or no HEAD
  }

  return status;
}
