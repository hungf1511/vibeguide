/** Git diff operations — diff between refs or working tree vs index. */
import { runGit, isGitRepo } from "./runGit.js";

export interface DiffEntry {
  file: string;
  changeType: "added" | "modified" | "deleted" | "renamed" | "copied";
  addedLines?: number;
  deletedLines?: number;
}

/** Get diff between two refs (default: working tree vs HEAD) */
export function getDiff(dir: string, ref1 = "HEAD", ref2?: string): DiffEntry[] {
  if (!isGitRepo(dir)) return [];
  const args = ["diff", "--name-status"];
  if (ref2) {
    args.push(`${ref1}..${ref2}`);
  } else if (ref1 !== "HEAD") {
    args.push(ref1);
  } else {
    args.push("HEAD");
  }
  try {
    const output = runGit(dir, args);
    return parseNameStatus(output);
  } catch {
    return [];
  }
}

/** Get diff with line counts (--stat) */
export function getDiffStat(dir: string, ref = "HEAD"): DiffEntry[] {
  if (!isGitRepo(dir)) return [];
  try {
    const output = runGit(dir, ["diff", "--numstat", ref]);
    return parseNumStat(output);
  } catch {
    return [];
  }
}

function parseNameStatus(output: string): DiffEntry[] {
  return output.split("\n").filter(Boolean).map((line) => {
    const [type, file] = line.split("\t");
    const trimmedType = type.trim();
    if (trimmedType.startsWith("R") || trimmedType.startsWith("C")) {
      const [_, ...rest] = line.split("\t");
      return { file: rest[rest.length - 1] || "", changeType: "renamed" as const };
    }
    const changeType = trimType(trimmedType);
    return { file: file || "", changeType };
  });
}

function parseNumStat(output: string): DiffEntry[] {
  return output.split("\n").filter(Boolean).map((line) => {
    const [added, deleted, ...fileParts] = line.split("\t");
    const file = fileParts.join("\t");
    const changeType = added === "0" && deleted === "0" ? "modified" as const : "modified" as const;
    return {
      file,
      changeType,
      addedLines: parseInt(added, 10) || 0,
      deletedLines: parseInt(deleted, 10) || 0,
    };
  });
}

function trimType(t: string): DiffEntry["changeType"] {
  if (t === "A") return "added";
  if (t === "D") return "deleted";
  if (t === "M") return "modified";
  return "modified";
}
