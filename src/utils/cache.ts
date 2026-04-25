/** JSON file cache với mtime-based invalidation cho dependency graph. */
import * as fs from "fs";
import * as path from "path";

const CACHE_DIR = path.resolve(process.cwd(), "cache");

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(repo: string): string {
  const safe = repo.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

interface CacheEnvelope<T> {
  signature: string;
  data: T;
}

/** Read cache entry only if signature matches; otherwise return null (caller must rescan). */
export function getIfFresh(repo: string, signature: string): Record<string, unknown> | null {
  ensureDir();
  const key = cacheKey(repo);
  if (!fs.existsSync(key)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(key, "utf-8")) as CacheEnvelope<Record<string, unknown>> | Record<string, unknown>;
    if (raw && typeof raw === "object" && "signature" in raw && (raw as CacheEnvelope<unknown>).signature === signature) {
      return (raw as CacheEnvelope<Record<string, unknown>>).data;
    }
    return null;
  } catch {
    return null;
  }
}

/** Set a cached value with TTL. */
export function set(repo: string, data: Record<string, unknown>, signature?: string): void {
  ensureDir();
  const payload: CacheEnvelope<Record<string, unknown>> = { signature: signature ?? "", data };
  fs.writeFileSync(cacheKey(repo), JSON.stringify(payload, null, 2), "utf-8");
}
