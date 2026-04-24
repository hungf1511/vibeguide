/** Snapshot repo bằng SHA-256 hash trước khi sửa code. */
import * as fs from "fs";
import * as path from "path";
import { createHash, randomBytes } from "crypto";
import { loadConfig, shouldIgnore } from "./configLoader.js";

const SNAPSHOT_DIR = path.resolve(process.cwd(), "cache", "snapshots");

function ensureSnapshotDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

function repoHash(repo: string): string {
  return createHash("sha256").update(repo).digest("hex").slice(0, 16);
}

function snapshotPath(repo: string, snapshotId: string): string {
  return path.join(SNAPSHOT_DIR, `${repoHash(repo)}_${snapshotId}.json`);
}

export interface SnapshotData {
  repo: string;
  snapshotId: string;
  label?: string;
  timestamp: string;
  files: SnapshotFile[];
}

interface SnapshotFile {
  path: string;
  hash: string;
  content: string;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function walkFiles(dir: string, base: string, result: string[], ignorePatterns: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".env") continue;
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build" || entry.name === ".next" || entry.name === ".cache" || entry.name === "coverage") continue;
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (shouldIgnore(normalizePath(rel), ignorePatterns)) continue;
    if (entry.isDirectory()) {
      walkFiles(full, rel, result, ignorePatterns);
    } else {
      result.push(rel);
    }
  }
}

export function createSnapshot(repo: string, label?: string): SnapshotData {
  ensureSnapshotDir();
  const files: string[] = [];
  const ignorePatterns = loadConfig(repo).ignorePatterns;
  walkFiles(repo, "", files, ignorePatterns);

  const snapshotFiles: SnapshotFile[] = [];
  for (const file of files) {
    const fullPath = path.join(repo, file);
    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const hash = createHash("sha256").update(content).digest("hex");
      snapshotFiles.push({ path: file, hash, content });
    } catch {
      // Skip unreadable files
    }
  }

  const snapshotId = randomBytes(8).toString("hex");
  const data: SnapshotData = {
    repo,
    snapshotId,
    label,
    timestamp: new Date().toISOString(),
    files: snapshotFiles,
  };

  fs.writeFileSync(snapshotPath(repo, snapshotId), JSON.stringify(data, null, 2), "utf-8");
  return data;
}

export function listSnapshots(repo: string): SnapshotData[] {
  ensureSnapshotDir();
  const prefix = `${repoHash(repo)}_`;
  const results: SnapshotData[] = [];
  if (!fs.existsSync(SNAPSHOT_DIR)) return results;
  const files = fs.readdirSync(SNAPSHOT_DIR);
  for (const file of files) {
    if (!file.startsWith(prefix)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, file), "utf-8")) as SnapshotData;
      results.push(data);
    } catch {
      // Skip corrupted snapshots
    }
  }
  return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function getSnapshot(repo: string, snapshotId: string): SnapshotData | null {
  const sp = snapshotPath(repo, snapshotId);
  if (!fs.existsSync(sp)) return null;
  try {
    return JSON.parse(fs.readFileSync(sp, "utf-8")) as SnapshotData;
  } catch {
    return null;
  }
}

export function restoreSnapshot(repo: string, snapshotId: string): { restored: boolean; filesChanged: number; filesDeleted: number } {
  const snapshot = getSnapshot(repo, snapshotId);
  if (!snapshot) return { restored: false, filesChanged: 0, filesDeleted: 0 };

  let filesChanged = 0;
  let filesDeleted = 0;
  const snapshotPaths = new Set(snapshot.files.map((file) => file.path));

  const currentFiles: string[] = [];
  const ignorePatterns = loadConfig(repo).ignorePatterns;
  walkFiles(repo, "", currentFiles, ignorePatterns);
  for (const file of currentFiles) {
    if (snapshotPaths.has(file)) continue;
    try {
      fs.unlinkSync(path.join(repo, file));
      filesDeleted++;
    } catch {
      // Skip files that cannot be removed.
    }
  }

  for (const file of snapshot.files) {
    const fullPath = path.join(repo, file.path);
    try {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let currentContent = "";
      try {
        currentContent = fs.readFileSync(fullPath, "utf-8");
      } catch {
        // File doesn't exist yet
      }
      if (currentContent !== file.content) {
        fs.writeFileSync(fullPath, file.content, "utf-8");
        filesChanged++;
      }
    } catch {
      // Skip unwritable files
    }
  }

  return { restored: true, filesChanged, filesDeleted };
}
