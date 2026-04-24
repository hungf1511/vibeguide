/** Repo exploration handlers — scan, get_file, get_deps, changelog, snapshot, diff_summary. */
import * as path from "path";
import type { TreeNode, DepGraph, ChangeLog, ChangelogResult, DependencyGraphResult, SnapshotResult, DiffSummaryResult } from "../../types.js";
import { resolveRepo, resolveSafe } from "../../utils/pathGuard.js";
import { scanDirectory, getFileContent, getGitStatus, getRecentCommits } from "../../utils/scanner.js";
import { generateChangelog } from "../../utils/changelog.js";
import { createSnapshot, listSnapshots, restoreSnapshot, getSnapshot } from "../../utils/snapshot.js";
import { getCachedDeps } from "./impact.js";
import type { FileScope } from "../../core/git/index.js";

export async function handleScanRepo(args: { repoPath?: string; scope?: FileScope }): Promise<{ summary: string; fileTypes: Record<string, number>; topLevelFolders: string[]; edges: DepGraph["edges"]; stats: { totalFiles: number; totalFolders: number }; git: { branch: string; modified: number; ahead: number }; files: string[] }> {
  const repo = resolveRepo(args.repoPath);
  const structure = scanDirectory(repo);
  const stats = countTree(structure);
  const deps = getCachedDeps(repo, args.scope);
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
  return {
    summary: `${summaryPrefix}. Branch: ${gitStatus.branch}. Nhieu nhat: ${Object.entries(fileTypes).sort((a, b) => b[1] - a[1])[0]?.join(" ") || "N/A"}.`,
    fileTypes,
    topLevelFolders,
    edges: deps.edges.slice(0, 50),
    stats: { totalFiles: args.scope ? deps.nodes.length : stats.files, totalFolders: stats.folders },
    git: { branch: gitStatus.branch, modified: gitStatus.modified.length, ahead: gitStatus.ahead },
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

function readComparableFiles(repo: string): Map<string, string> {
  const files = new Map<string, string>();
  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.type === "file") {
        const content = getFileContent(node.path, repo);
        if (content !== null) files.set(node.path, content);
      } else if (node.children) {
        walk(node.children);
      }
    }
  }
  walk(scanDirectory(repo));
  return files;
}

export async function handleGetFile(args: { filePath: string; repoPath?: string }): Promise<{ content: string | null; truncated: boolean }> {
  const repo = resolveRepo(args.repoPath);
  const safePath = resolveSafe(args.filePath, repo);
  const relativePath = path.relative(repo, safePath).replace(/\\/g, "/");
  const content = getFileContent(relativePath, repo);
  if (!content) return { content: null, truncated: false };
  return { content: content.length > 50000 ? content.slice(0, 50000) : content, truncated: content.length > 50000 };
}

export async function handleGetDeps(args: { repoPath?: string; scope?: FileScope }): Promise<DepGraph> {
  return getCachedDeps(resolveRepo(args.repoPath), args.scope);
}

export async function handleWhatChanged(args: { repoPath?: string }): Promise<ChangeLog> {
  const repo = resolveRepo(args.repoPath);
  const commits = getRecentCommits(repo, 5);
  const files = getGitStatus(repo).modified;
  const featureSet = new Set<string>();
  for (const f of files) { const parts = f.split("/"); if (parts.length > 1) featureSet.add(parts[0]); }
  return { commits, files, features: Array.from(featureSet) };
}

export async function handleChangelog(args: { repoPath?: string; count?: number }): Promise<ChangelogResult> {
  const repo = resolveRepo(args.repoPath);
  return generateChangelog(repo, args.count ?? 20);
}

export async function handleDepGraph(args: { repoPath?: string; format?: string; scope?: FileScope }): Promise<DependencyGraphResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo, args.scope);
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

export async function handleSnapshot(args: { repoPath?: string; label?: string; action?: string; snapshotId?: string }): Promise<SnapshotResult> {
  const repo = resolveRepo(args.repoPath);
  const action = args.action || "create";
  if (action === "create") {
    const data = createSnapshot(repo, args.label);
    return { snapshotId: data.snapshotId, fileCount: data.files.length, timestamp: data.timestamp, label: data.label };
  }
  if (action === "list") {
    const snaps = listSnapshots(repo);
    return { snapshotId: "", fileCount: 0, timestamp: new Date().toISOString(), snapshots: snaps.map((s) => ({ id: s.snapshotId, label: s.label, timestamp: s.timestamp, fileCount: s.files.length })) };
  }
  if (action === "restore") {
    if (!args.snapshotId) throw new Error("snapshotId required for restore");
    const result = restoreSnapshot(repo, args.snapshotId);
    return { snapshotId: args.snapshotId, fileCount: result.filesChanged + result.filesDeleted, timestamp: new Date().toISOString(), restored: result.restored, filesChanged: result.filesChanged, filesDeleted: result.filesDeleted };
  }
  throw new Error(`Unknown action: ${action}`);
}

export async function handleDiffSummary(args: { repoPath?: string; since?: string; snapshotId?: string }): Promise<DiffSummaryResult> {
  const repo = resolveRepo(args.repoPath);
  const since = args.since || "git";
  const currentFiles = readComparableFiles(repo);
  let changedFiles: { file: string; changeType: "added" | "modified" | "deleted"; description: string }[] = [];
  if (since === "snapshot" && args.snapshotId) {
    const snapshot = getSnapshot(repo, args.snapshotId);
    if (!snapshot) throw new Error("Snapshot not found");
    const snapshotFiles = new Map<string, string>();
    for (const f of snapshot.files) snapshotFiles.set(f.path, f.content);
    for (const [file] of snapshotFiles) {
      if (!currentFiles.has(file)) changedFiles.push({ file, changeType: "deleted", description: `Xoa file ${file}` });
    }
    for (const [file, content] of currentFiles) {
      if (!snapshotFiles.has(file)) { changedFiles.push({ file, changeType: "added", description: `Them file ${file}` }); }
      else if (snapshotFiles.get(file) !== content) { changedFiles.push({ file, changeType: "modified", description: inferChangeDescription(file, content) }); }
    }
  } else if (since === "git") {
    try {
      const { execSync } = await import("child_process");
      const output = execSync("git status --short", { cwd: repo, encoding: "utf-8" });
      for (const line of output.split("\n").filter(Boolean)) {
        const status = line.slice(0, 2).trim();
        const file = line.slice(3).trim();
        if (status === "D") changedFiles.push({ file, changeType: "deleted", description: `Xoa file ${file}` });
        else if (status === "??") changedFiles.push({ file, changeType: "added", description: `Them file ${file}` });
        else { const content = getFileContent(file, repo); changedFiles.push({ file, changeType: "modified", description: content ? inferChangeDescription(file, content) : `Cap nhat ${file}` }); }
      }
    } catch { /* no git */ }
  } else {
    const snaps = listSnapshots(repo);
    if (snaps.length > 0) {
      const last = snaps[0];
      const snapshotFiles = new Map<string, string>();
      for (const f of last.files) snapshotFiles.set(f.path, f.content);
      for (const [file] of snapshotFiles) { if (!currentFiles.has(file)) changedFiles.push({ file, changeType: "deleted", description: `Xoa file ${file}` }); }
      for (const [file, content] of currentFiles) {
        if (!snapshotFiles.has(file)) changedFiles.push({ file, changeType: "added", description: `Them file ${file}` });
        else if (snapshotFiles.get(file) !== content) changedFiles.push({ file, changeType: "modified", description: inferChangeDescription(file, content) });
      }
    }
  }
  const summary = changedFiles.length === 0
    ? "Khong co thay doi nao."
    : `Co ${changedFiles.length} file thay doi: ${changedFiles.filter((f) => f.changeType === "modified").length} sua, ${changedFiles.filter((f) => f.changeType === "added").length} them, ${changedFiles.filter((f) => f.changeType === "deleted").length} xoa.`;
  const riskAssessment = changedFiles.length > 5 ? "Nhieu file thay doi - nen test ky truoc khi deploy." : "Thay doi it - risk thap.";
  return { summary, filesChanged: changedFiles, riskAssessment, totalFiles: changedFiles.length };
}

function inferChangeDescription(file: string, content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("fix") || lower.includes("bug") || lower.includes("repair")) return `Sua loi o ${file}`;
  if (lower.includes("add") || lower.includes("new ") || lower.includes("introduce")) return `Them tinh nang vao ${file}`;
  if (lower.includes("refactor") || lower.includes("rewrite")) return `Tai cau truc ${file}`;
  if (lower.includes("remove") || lower.includes("delete") || lower.includes("clean")) return `Don dep ${file}`;
  if (lower.includes("update") || lower.includes("upgrade")) return `Cap nhat ${file}`;
  return `Chinh sua ${file}`;
}
