/** Snapshot and diff-summary handlers. */
import * as path from "path";
import type { DiffSummaryResult, SnapshotResult, TreeNode } from "../../types.js";
import { resolveRepo } from "../../utils/pathGuard.js";
import { getFileContent, scanDirectory } from "../../utils/scanner.js";
import { createSnapshot, getSnapshot, listSnapshots, restoreSnapshot } from "../../utils/snapshot.js";

/** Create, list, or restore local file-content snapshots. */
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

/** Summarize changes against git status, the latest snapshot, or a selected snapshot. */
export async function handleDiffSummary(args: { repoPath?: string; since?: string; snapshotId?: string }): Promise<DiffSummaryResult> {
  const repo = resolveRepo(args.repoPath);
  const since = args.since || "git";
  const currentFiles = readComparableFiles(repo);
  let changedFiles: { file: string; changeType: "added" | "modified" | "deleted"; description: string }[] = [];
  if (since === "snapshot" && args.snapshotId) {
    changedFiles = diffAgainstSnapshot(repo, args.snapshotId, currentFiles);
  } else if (since === "git") {
    try {
      const gitDiff = await diffAgainstGit(repo);
      if (!gitDiff.available) {
        return {
          summary: `Khong kiem tra duoc diff: ${gitDiff.error ?? "git unavailable"}`,
          filesChanged: [],
          riskAssessment: "Can review thu cong.",
          totalFiles: 0,
        };
      }
      changedFiles = gitDiff.changes;
    } catch {
      return {
        summary: "Khong kiem tra duoc diff: git unavailable",
        filesChanged: [],
        riskAssessment: "Can review thu cong.",
        totalFiles: 0,
      };
    }
  } else {
    changedFiles = diffAgainstLatestSnapshot(repo, currentFiles);
  }
  const summary = summarizeChangedFiles(changedFiles);
  const riskAssessment = changedFiles.length > 5 ? "Nhieu file thay doi - nen test ky truoc khi deploy." : "Thay doi it - risk thap.";
  return { summary, filesChanged: changedFiles, riskAssessment, totalFiles: changedFiles.length };
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

function diffAgainstSnapshot(repo: string, snapshotId: string, currentFiles: Map<string, string>) {
  const snapshot = getSnapshot(repo, snapshotId);
  if (!snapshot) throw new Error("Snapshot not found");
  return diffFileMaps(new Map(snapshot.files.map((file) => [file.path, file.content])), currentFiles);
}

function diffAgainstLatestSnapshot(repo: string, currentFiles: Map<string, string>) {
  const last = listSnapshots(repo)[0];
  return last ? diffFileMaps(new Map(last.files.map((file) => [file.path, file.content])), currentFiles) : [];
}

async function diffAgainstGit(repo: string): Promise<{ available: boolean; error?: string; changes: { file: string; changeType: "added" | "modified" | "deleted"; description: string }[] }> {
  try {
    const { execSync } = await import("child_process");
    const output = execSync("git status --short", { cwd: repo, encoding: "utf-8" });
    const changedFiles: { file: string; changeType: "added" | "modified" | "deleted"; description: string }[] = [];
    for (const line of output.split("\n").filter(Boolean)) {
      const status = line.slice(0, 2).trim();
      const file = line.slice(3).trim();
      if (status === "D") changedFiles.push({ file, changeType: "deleted", description: `Xoa file ${file}` });
      else if (status === "??") changedFiles.push({ file, changeType: "added", description: `Them file ${file}` });
      else {
        const content = getFileContent(file, repo);
        changedFiles.push({ file, changeType: "modified", description: content ? inferChangeDescription(file, content) : `Cap nhat ${file}` });
      }
    }
    return { available: true, changes: changedFiles };
  } catch (err) {
    return { available: false, error: (err as Error).message, changes: [] };
  }
}

function diffFileMaps(previous: Map<string, string>, current: Map<string, string>) {
  const changedFiles: { file: string; changeType: "added" | "modified" | "deleted"; description: string }[] = [];
  for (const [file] of previous) {
    if (!current.has(file)) changedFiles.push({ file, changeType: "deleted", description: `Xoa file ${file}` });
  }
  for (const [file, content] of current) {
    if (!previous.has(file)) changedFiles.push({ file, changeType: "added", description: `Them file ${file}` });
    else if (previous.get(file) !== content) changedFiles.push({ file, changeType: "modified", description: inferChangeDescription(file, content) });
  }
  return changedFiles;
}

function summarizeChangedFiles(changedFiles: { changeType: "added" | "modified" | "deleted" }[]): string {
  return changedFiles.length === 0
    ? "Khong co thay doi nao."
    : `Co ${changedFiles.length} file thay doi: ${changedFiles.filter((f) => f.changeType === "modified").length} sua, ${changedFiles.filter((f) => f.changeType === "added").length} them, ${changedFiles.filter((f) => f.changeType === "deleted").length} xoa.`;
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
