/** Lightweight working tree status used by repo summaries. */
import * as fs from "fs";
import * as path from "path";
import { runGit } from "./runGit.js";

export interface WorkingStatus {
  available: boolean;
  error?: string;
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead: number;
}

/** Return branch, changed files, and ahead count for a repository. */
export function getWorkingStatus(repoPath: string): WorkingStatus {
  const status: WorkingStatus = { available: false, branch: "unknown", modified: [], staged: [], untracked: [], ahead: 0 };
  try {
    const output = runGit(repoPath, ["status", "--short", "--branch"]);
    for (const line of output.split("\n").filter(Boolean)) {
      if (line.startsWith("## ")) readBranchStatus(line, status);
      else addChangedFile(line, status);
    }
    status.available = true;
    return status;
  } catch (err) {
    status.error = (err as Error).message;
    return getFallbackGitStatus(repoPath, status);
  }
}

function readBranchStatus(line: string, status: WorkingStatus): void {
  const branchInfo = line.slice(3).trim();
  const branchName = branchInfo.split("...")[0].split(" ")[0];
  if (branchName) status.branch = branchName;
  const aheadMatch = branchInfo.match(/ahead (\d+)/);
  if (aheadMatch) status.ahead = parseInt(aheadMatch[1], 10);
}

function addChangedFile(line: string, status: WorkingStatus): void {
  const filePart = line.slice(3).trim();
  const renamedTarget = filePart.includes(" -> ") ? filePart.split(" -> ").pop() : filePart;
  if (!renamedTarget) return;
  const normalized = renamedTarget.replace(/\\/g, "/");
  const prefix = line.slice(0, 2);
  if (prefix[0] === "A" || prefix[0] === "M" || prefix[0] === "D" || prefix[0] === "R") {
    if (prefix[0] === "A") status.staged.push(normalized);
    else if (prefix[0] === "D") status.staged.push(normalized);
    else status.staged.push(normalized);
  }
  if (prefix[1] === "M" || prefix[1] === "D") {
    status.modified.push(normalized);
  }
  if (prefix === "??") {
    status.untracked.push(normalized);
  }
}

/** Aggregate all dirty paths (modified + staged + untracked), deduplicated. */
export function dirtyPaths(status: WorkingStatus): string[] {
  if (!status.available) return [];
  const set = new Set<string>([...status.modified, ...status.staged, ...status.untracked]);
  return Array.from(set);
}

function getFallbackGitStatus(repoPath: string, status: WorkingStatus): WorkingStatus {
  try {
    const head = fs.readFileSync(path.join(repoPath, ".git", "HEAD"), "utf-8").trim();
    if (head.startsWith("ref: ")) status.branch = head.replace("ref: refs/heads/", "");
  } catch {
    // Non-git directory.
  }
  return status;
}
