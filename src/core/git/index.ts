/** Barrel export for git core module. */
export { runGit, isGitRepo } from "./runGit.js";
export { lsFiles, normalizePath } from "./lsFiles.js";
export { getHead, getCacheSignature } from "./head.js";
export type { HeadInfo } from "./head.js";
export { getLog, getLogWithFiles, getFilesChanged } from "./log.js";
export type { CommitInfo, CommitWithFiles } from "./log.js";
export { getDiff, getDiffStat } from "./diff.js";
export type { DiffEntry } from "./diff.js";
export { getBlame } from "./blame.js";
export type { BlameEntry } from "./blame.js";
