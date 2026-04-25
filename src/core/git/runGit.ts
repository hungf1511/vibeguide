/** Run git command safely, return stdout or throw. */
import { execFileSync } from "child_process";
import * as path from "path";

/** Execute a git command with simple-git and return stdout. */
export function runGit(repoPath: string, args: string[], options?: { stdio?: "pipe" | "inherit" }): string {
  const safeRepo = path.resolve(repoPath);
  return execFileSync("git", ["-C", safeRepo, ...args], {
    cwd: repoPath,
    encoding: "utf-8",
    stdio: ["ignore", options?.stdio === "inherit" ? "inherit" : "pipe", "ignore"],
    maxBuffer: 10 * 1024 * 1024,
  });
}

/** Check if dir is a git repo (has .git) */
export function isGitRepo(dir: string): boolean {
  try {
    runGit(dir, ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}
