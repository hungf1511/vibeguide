/** MCP tool handlers for index build/status/clear. */
import * as fs from "fs";
import * as path from "path";
import { resolveRepo } from "../../utils/pathGuard.js";
import { IndexStore } from "../../index/store.js";
import { IndexBuilder } from "../../index/builder.js";
import { getRepoSignature } from "../../utils/scanner.js";

export interface BuildStats {
  filesIndexed: number;
  importsIndexed: number;
  exportsIndexed: number;
  symbolsIndexed: number;
  commitsIndexed: number;
  durationMs: number;
}

/** Build or rebuild the SQLite index for a repository. */
export async function handleIndexBuild(args: { repoPath?: string; force?: boolean }): Promise<{ stats: BuildStats; durationMs: number }> {
  const repo = resolveRepo(args.repoPath);
  const dbPath = path.join(repo, ".vibeguide", "index.db");

  if (args.force && fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const store = IndexStore.open(dbPath);
  const builder = new IndexBuilder(store, repo);
  const start = Date.now();
  const stats = await builder.buildFull();
  const durationMs = Date.now() - start;
  store.close();

  return { stats, durationMs };
}

/** Report index status: exists, freshness, file count, size. */
export async function handleIndexStatus(args: { repoPath?: string }): Promise<{
  exists: boolean;
  files: number;
  lastBuildAt?: string;
  isFresh: boolean;
  sizeBytes?: number;
}> {
  const repo = resolveRepo(args.repoPath);
  const dbPath = path.join(repo, ".vibeguide", "index.db");

  if (!fs.existsSync(dbPath)) {
    return { exists: false, files: 0, isFresh: false };
  }

  let store: IndexStore | undefined;
  try {
    store = IndexStore.open(dbPath);
    const files = store.countFiles();
    const lastIndexed = store.getLastIndexedAt();
    const sizeBytes = fs.statSync(dbPath).size;
    const storedSig = store.getMetaSignature();
    let currentSig: string | undefined;
    try {
      currentSig = getRepoSignature(repo);
    } catch {
      currentSig = undefined;
    }
    const isFresh = storedSig !== undefined && currentSig !== undefined && storedSig === currentSig;

    return {
      exists: true,
      files,
      lastBuildAt: lastIndexed ? new Date(lastIndexed).toISOString() : undefined,
      isFresh,
      sizeBytes,
    };
  } catch {
    return { exists: true, files: 0, isFresh: false };
  } finally {
    store?.close();
  }
}

/** Remove the index database for a repository. */
export async function handleIndexClear(args: { repoPath?: string }): Promise<{ removed: boolean; path: string }> {
  const repo = resolveRepo(args.repoPath);
  const dbPath = path.join(repo, ".vibeguide", "index.db");

  if (!fs.existsSync(dbPath)) {
    return { removed: false, path: dbPath };
  }

  fs.unlinkSync(dbPath);
  return { removed: true, path: dbPath };
}
