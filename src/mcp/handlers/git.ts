/** Git-native tool handlers — vibeguide_git_status, vibeguide_git_log. */
import { resolveRepo } from "../../utils/pathGuard.js";
import { getHead, getLog, getLogWithFiles } from "../../core/git/index.js";
import type { CommitWithFiles } from "../../core/git/index.js";

interface GitStatusResult {
  branch: string;
  sha: string;
  shortSha: string;
  isClean: boolean;
  dirtyFiles: number;
  summary: string;
}

interface GitLogResult {
  commits: {
    sha: string;
    shortSha: string;
    author: string;
    date: string;
    message: string;
    refName?: string;
    files?: { changeType: string; changedFile: string }[];
  }[];
  total: number;
  summary: string;
}

export async function handleGitStatus(args: { repoPath?: string }): Promise<GitStatusResult> {
  const repo = resolveRepo(args.repoPath);
  const head = getHead(repo);
  const summary = head.isClean
    ? `Branch ${head.branch} (${head.shortSha}) — sạch, không có thay đổi.`
    : `Branch ${head.branch} (${head.shortSha}) — có ${head.dirtyCount} file chưa commit.`;

  return {
    branch: head.branch,
    sha: head.sha,
    shortSha: head.shortSha,
    isClean: head.isClean,
    dirtyFiles: head.dirtyCount,
    summary,
  };
}

export async function handleGitLog(args: { repoPath?: string; count?: number; since?: string; until?: string; showFiles?: boolean }): Promise<GitLogResult> {
  const repo = resolveRepo(args.repoPath);
  const count = args.count ?? 20;
  const since = args.since;
  const until = args.until;
  const showFiles = args.showFiles ?? false;

  let commits: GitLogResult["commits"];
  if (showFiles) {
    const raw = getLogWithFiles(repo, count, since, until);
    commits = raw.map((c: CommitWithFiles) => ({
      sha: c.sha,
      shortSha: c.shortSha,
      author: c.author,
      date: c.date,
      message: c.message,
      files: c.files,
    }));
  } else {
    commits = getLog(repo, count, since, until).map((c) => ({
      sha: c.sha,
      shortSha: c.shortSha,
      author: c.author,
      date: c.date,
      message: c.message,
      refName: c.refName,
    }));
  }

  const summary = commits.length > 0
    ? `${commits.length} commit gần đây trên ${commits[0].refName || "HEAD"}.`
    : "Không có commit nào.";

  return { commits, total: commits.length, summary };
}
