/** Monorepo route handler. */
import { resolveRepo } from "../../utils/pathGuard.js";
import { analyzeMonorepo } from "../../utils/monorepo.js";
import type { MonorepoRouteResult } from "../../types.js";

/** Route a request to the matching workspace package in a monorepo. */
export async function handleMonorepoRoute(args: { repoPath?: string; changedFiles?: string[] }): Promise<MonorepoRouteResult> {
  const repo = resolveRepo(args.repoPath);
  return analyzeMonorepo(repo, args.changedFiles || []);
}
