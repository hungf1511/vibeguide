/** Repo exploration handlers � scan, get_file, get_deps, changelog, snapshot, diff_summary. */
import * as path from "path";
import type { TreeNode, DepGraph, ChangeLog, ChangelogResult, DependencyGraphResult } from "../../types.js";
import { resolveRepo, resolveSafe } from "../../utils/pathGuard.js";
import { scanDirectory, getFileContent, getGitStatus, getRecentCommits } from "../../utils/scanner.js";
import { getWorkingStatus, dirtyPaths } from "../../core/git/status.js";
import { generateChangelog } from "../../utils/changelog.js";
import { getCachedDeps } from "./impact.js";
import type { FileScope } from "../../core/git/index.js";

/** Scan a repo and return dependency edges. */
export async function handleScanRepo(args: { repoPath?: string; scope?: FileScope }): Promise<{ summary: string; fileTypes: Record<string, number>; topLevelFolders: string[]; edges: DepGraph["edges"]; stats: { totalFiles: number; totalFolders: number }; git: { branch: string; modified: number; ahead: number }; files: string[] }> {
  const repo = resolveRepo(args.repoPath);
  const structure = scanDirectory(repo);
  const stats = countTree(structure);
  const deps = await (getCachedDeps(repo, args.scope));
  const allFiles: string[] = [];
  const fileTypes: Record<string, number> = {};
  function walkTree(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.type === "file") {
        allFiles.push(node.path);
        const ext = path.extname(node.name) || "no-ext";
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      } else if (node.children) {
        walkTree(node.children);
      }
    }
  }
  walkTree(structure);
  const topLevelFolders = structure.filter((n) => n.type === "folder").map((n) => n.name);
  const gitStatus = getGitStatus(repo);
  const files = args.scope ? deps.nodes : allFiles;
  const summaryPrefix = args.scope ? `Scope co ${deps.nodes.length} source file` : `Repo co ${stats.files} file, ${stats.folders} folder`;
  if (!gitStatus.available) {
    return {
      summary: `${summaryPrefix}. Branch: ${gitStatus.branch ?? "unknown"}. Git unavailable: ${gitStatus.error ?? "unknown"}.`,
      fileTypes,
      topLevelFolders,
      edges: deps.edges.slice(0, 50),
      stats: { totalFiles: args.scope ? deps.nodes.length : stats.files, totalFolders: stats.folders },
      git: { branch: gitStatus.branch ?? "unknown", modified: 0, ahead: 0 },
      files: files.slice(0, 100),
    };
  }
  return {
    summary: `${summaryPrefix}. Branch: ${gitStatus.branch}. Nhieu nhat: ${Object.entries(fileTypes).sort((a, b) => b[1] - a[1])[0]?.join(" ") || "N/A"}.`,
    fileTypes,
    topLevelFolders,
    edges: deps.edges.slice(0, 50),
    stats: { totalFiles: args.scope ? deps.nodes.length : stats.files, totalFolders: stats.folders },
    git: { branch: gitStatus.branch, modified: dirtyPaths(gitStatus).length, ahead: gitStatus.ahead },
    files: files.slice(0, 100),
  };
}

function countTree(items: TreeNode[]): { files: number; folders: number } {
  let files = 0, folders = 0;
  for (const item of items) {
    if (item.type === "file") files++;
    else { folders++; if (item.children) { const c = countTree(item.children); files += c.files; folders += c.folders; } }
  }
  return { files, folders };
}

/** Read a file with safe path guard. */
export async function handleGetFile(args: { filePath: string; repoPath?: string }): Promise<{ content: string | null; truncated: boolean }> {
  const repo = resolveRepo(args.repoPath);
  const safePath = resolveSafe(args.filePath, repo);
  const relativePath = path.relative(repo, safePath).replace(/\\/g, "/");
  const content = getFileContent(relativePath, repo);
  if (!content) return { content: null, truncated: false };
  return { content: content.length > 50000 ? content.slice(0, 50000) : content, truncated: content.length > 50000 };
}

/** Get dependency graph for a repo. */
export async function handleGetDeps(args: { repoPath?: string; scope?: FileScope }): Promise<DepGraph> {
  return getCachedDeps(resolveRepo(args.repoPath), args.scope);
}

/** Show files changed since a commit or snapshot. */
export async function handleWhatChanged(args: { repoPath?: string }): Promise<ChangeLog & { available?: boolean; error?: string; summary?: string }> {
  const repo = resolveRepo(args.repoPath);
  const status = getWorkingStatus(repo);
  if (!status.available) {
    return { commits: [], files: [], features: [], available: false, error: status.error, summary: `Khong kiem tra duoc git status: ${status.error ?? "unknown"}` };
  }
  const commits = getRecentCommits(repo, 5);
  const files = dirtyPaths(status);
  const featureSet = new Set<string>();
  for (const f of files) { const parts = f.split("/"); if (parts.length > 1) featureSet.add(parts[0]); }
  return { commits, files, features: Array.from(featureSet) };
}

/** Generate changelog from commits. */
export async function handleChangelog(args: { repoPath?: string; count?: number }): Promise<ChangelogResult> {
  const repo = resolveRepo(args.repoPath);
  return generateChangelog(repo, args.count ?? 20);
}

/** Return dependency graph as JSON. */
export async function handleDepGraph(args: { repoPath?: string; format?: string; scope?: FileScope }): Promise<DependencyGraphResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = await (getCachedDeps(repo, args.scope));
  const fmt = args.format || "mermaid";
  if (fmt === "json") {
    return { mermaid: JSON.stringify({ nodes: deps.nodes, edges: deps.edges }, null, 2), nodes: deps.nodes.length, edges: deps.edges.length };
  }
  const nodeIds = new Map<string, string>();
  let idCounter = 0;
  function getId(file: string): string {
    if (!nodeIds.has(file)) { nodeIds.set(file, `N${idCounter++}`); }
    return nodeIds.get(file)!;
  }
  const lines = ["graph TD"];
  const folderMap = new Map<string, string[]>();
  for (const file of deps.nodes) {
    const dir = path.dirname(file).replace(/\\/g, "/") || "root";
    if (!folderMap.has(dir)) folderMap.set(dir, []);
    folderMap.get(dir)!.push(file);
  }
  for (const [dir, files] of folderMap) {
    if (files.length > 1) {
      lines.push(`  subgraph ${dir.replace(/[^a-zA-Z0-9_/]/g, "_")}`);
      for (const file of files) { lines.push(`    ${getId(file)}[${path.basename(file, path.extname(file))}]`); }
      lines.push(`  end`);
    } else {
      lines.push(`  ${getId(files[0])}[${path.basename(files[0], path.extname(files[0]))}]`);
    }
  }
  for (const edge of deps.edges) { lines.push(`  ${getId(edge.from)} --> ${getId(edge.to)}`); }
  return { mermaid: lines.join("\n"), nodes: deps.nodes.length, edges: deps.edges.length };
}
