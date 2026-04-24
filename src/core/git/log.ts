/** Git log — structured commit history, scope-based filtering. */
import { runGit, isGitRepo } from "./runGit.js";

export interface CommitInfo {
  sha: string;
  shortSha: string;
  author: string;
  date: string;
  message: string;
  refName?: string;
}

/** Format for machine-readable git log output */
const LOG_FORMAT = [
  "---COMMIT---",
  "%H",       // full SHA
  "%h",       // short SHA
  "%an",      // author name
  "%ai",      // author date (ISO 8601)
  "%D",       // ref names
  "%s",       // subject
  "%b",       // body (rest until next ---COMMIT---)
].join("%n");

/** Get recent commits. Count limit, optional since/until dates (ISO 8601). */
export function getLog(dir: string, count = 20, since?: string, until?: string): CommitInfo[] {
  if (!isGitRepo(dir)) return [];

  const args = ["log", `--format=${LOG_FORMAT}`];
  if (since) args.push("--since", since);
  if (until) args.push("--until", until);
  args.push(`-${count}`);

  try {
    const output = runGit(dir, args);
    return parseLogOutput(output.trim());
  } catch {
    return [];
  }
}

/** Parse git log output into structured commits */
function parseLogOutput(output: string): CommitInfo[] {
  if (!output) return [];
  const blocks = output.split("---COMMIT---\n").filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const sha = lines[0] || "";
    const shortSha = lines[1] || "";
    const author = lines[2] || "";
    const date = lines[3] || "";
    const refName = lines[4] || "";
    const subject = lines[5] || "";
    return {
      sha,
      shortSha,
      author,
      date,
      refName: refName || undefined,
      message: subject,
    };
  });
}

export interface CommitWithFiles extends CommitInfo {
  files: { changeType: string; changedFile: string }[];
}

/** Get log with changed files per commit (uses --name-status) */
export function getLogWithFiles(dir: string, count = 20, since?: string, until?: string): CommitWithFiles[] {
  if (!isGitRepo(dir)) return [];

  try {
    const args = ["log", "--name-status", `--format=${LOG_FORMAT}`];
    if (since) args.push("--since", since);
    if (until) args.push("--until", until);
    args.push(`-${count}`);
    const output = runGit(dir, args);
    return parseLogWithFiles(output.trim());
  } catch {
    return [];
  }
}

function parseLogWithFiles(output: string): CommitWithFiles[] {
  if (!output) return [];
  const blocks = output.split("---COMMIT---\n").filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    const sha = lines[0] || "";
    const shortSha = lines[1] || "";
    const author = lines[2] || "";
    const date = lines[3] || "";
    const refName = lines[4] || "";
    const subject = lines[5] || "";
    const files: { changeType: string; changedFile: string }[] = [];
    for (let i = 6; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split("\t");
      if (parts.length >= 2) {
        files.push({ changeType: parts[0], changedFile: parts[parts.length - 1] });
      }
    }
    return {
      sha,
      shortSha,
      author,
      date,
      refName: refName || undefined,
      message: subject,
      files,
    };
  });
}

/** Get files changed in a commit range */
export function getFilesChanged(dir: string, since: string, until = "HEAD"): string[] {
  if (!isGitRepo(dir)) return [];
  try {
    const output = runGit(dir, ["diff", "--name-only", `${since}..${until}`]);
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
