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

export function get(repo: string): Record<string, unknown> | null {
  ensureDir();
  const key = cacheKey(repo);
  if (!fs.existsSync(key)) return null;
  try {
    return JSON.parse(fs.readFileSync(key, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function set(repo: string, data: Record<string, unknown>): void {
  ensureDir();
  fs.writeFileSync(cacheKey(repo), JSON.stringify(data, null, 2), "utf-8");
}

export function getFileHashes(repo: string): Record<string, string> | null {
  const key = cacheKey(repo) + ".hashes";
  if (!fs.existsSync(key)) return null;
  try {
    return JSON.parse(fs.readFileSync(key, "utf-8")) as Record<string, string>;
  } catch {
    return null;
  }
}

export function setFileHashes(repo: string, hashes: Record<string, string>): void {
  ensureDir();
  fs.writeFileSync(cacheKey(repo) + ".hashes", JSON.stringify(hashes, null, 2), "utf-8");
}

export function invalidate(repo: string): void {
  const key = cacheKey(repo);
  if (fs.existsSync(key)) {
    fs.unlinkSync(key);
  }
}
