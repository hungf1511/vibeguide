/** Factory to auto-detect whether to use SQLite index or in-memory scanner. */
import * as fs from "fs";
import * as path from "path";
import { IndexStore } from "../store.js";
import { IndexBuilder } from "../builder.js";
import { InMemoryQueries } from "./inMemory.js";
import { SqliteQueries } from "./sqlite.js";
import { getRepoSignature } from "../../utils/scanner.js";
import type { Queries } from "./types.js";

const rebuildLocks = new Map<string, Promise<void>>();

/** Return a Queries implementation for the repository. */
export async function getQueries(repoPath: string): Promise<Queries> {
  const dbPath = path.join(repoPath, ".vibeguide", "index.db");
  if (!fs.existsSync(dbPath)) {
    return new InMemoryQueries(repoPath);
  }

  let store: IndexStore;
  try {
    store = IndexStore.open(dbPath);
  } catch (err) {
    process.stderr.write(`[vibeguide] index DB unreadable, using in-memory: ${(err as Error).message}` + "\n");
    return new InMemoryQueries(repoPath);
  }

  const storedSig = store.getMetaSignature();
  let currentSig: string;
  try {
    currentSig = getRepoSignature(repoPath);
  } catch {
    store.close();
    return new InMemoryQueries(repoPath);
  }

  if (storedSig === currentSig) {
    return new SqliteQueries(store, repoPath);
  }

  if (process.env.VIBEGUIDE_AUTO_INDEX === "1") {
    let lock = rebuildLocks.get(repoPath);
    if (!lock) {
      lock = (async () => {
        try {
          const builder = new IndexBuilder(store, repoPath);
          await builder.buildIncremental();
        } finally {
          rebuildLocks.delete(repoPath);
        }
      })();
      rebuildLocks.set(repoPath, lock);
    }
    try {
      await lock;
      return new SqliteQueries(store, repoPath);
    } catch (err) {
      process.stderr.write(`[vibeguide] auto-rebuild failed, using in-memory: ${(err as Error).message}` + "\n");
      store.close();
      return new InMemoryQueries(repoPath);
    }
  }

  process.stderr.write("[vibeguide] index stale, run vibeguide_index_build to refresh" + "\n");
  store.close();
  return new InMemoryQueries(repoPath);
}
