/** Git HEAD info — cache signature, branch name, dirty state. */
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { runGit, isGitRepo } from "./runGit.js";

export interface HeadInfo {
  /** Full SHA of HEAD */
  sha: string;
  /** Short SHA (7 chars) */
  shortSha: string;
  /** Branch name */
  branch: string;
  /** Whether working tree is clean */
  isClean: boolean;
  /** Number of modified files */
  dirtyCount: number;
}

/** Get HEAD info. Throws if not a git repo. */
export function getHead(dir: string): HeadInfo {
  const sha = runGit(dir, ["rev-parse", "HEAD"]).trim();
  const shortSha = runGit(dir, ["rev-parse", "--short", "HEAD"]).trim();
  const branch = runGit(dir, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const status = runGit(dir, ["status", "--porcelain"]);
  const dirtyLines = status.split("\n").filter(Boolean);
  return {
    sha,
    shortSha,
    branch: branch === "HEAD" ? "detached" : branch,
    isClean: dirtyLines.length === 0,
    dirtyCount: dirtyLines.length,
  };
}

/**
 * Compute a stable cache signature for the repo.
 * Content-addressed: only changes when HEAD changes or working tree is dirty.
 * Does NOT invalidate on branch switch (unlike BN2 mtime-based signature).
 */
export function getCacheSignature(dir: string): string {
  if (!isGitRepo(dir)) {
    return getFallbackSignature(dir);
  }
  try {
    const head = getHead(dir);
    const hash = createHash("sha256");
    hash.update(head.sha);
    if (!head.isClean) {
      const status = runGit(dir, ["status", "--porcelain"]);
      hash.update(status);
    }
    return hash.digest("hex").slice(0, 16);
  } catch {
    return getFallbackSignature(dir);
  }
}

/** Fallback: mtime-based signature for non-git repos */
function getFallbackSignature(dir: string): string {
  let totalMtime = 0;
  let count = 0;
  function walk(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        try {
          totalMtime += fs.statSync(full).mtimeMs;
          count++;
        } catch { /* skip */ }
      }
    }
  }
  walk(dir);
  return `${count}-${Math.floor(totalMtime)}`;
}
