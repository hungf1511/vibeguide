/** SQLite wrapper for VibeGuide index � open, migrate, prepared statements, transactions. */
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface FileRow {
  path: string;
  git_oid: string;
  language?: string;
  lines?: number;
  last_indexed_at?: number;
}

export interface ImportRow {
  from_file: string;
  to_file: string;
  specifier?: string;
}

export interface ExportRow {
  file: string;
  symbol: string;
  kind?: string;
  line?: number;
}

export interface SymbolRow {
  file: string;
  name: string;
  kind?: string;
  line?: number;
  scope?: string;
}

export interface OwnershipRow {
  file: string;
  author: string;
  commits?: number;
  last_touch?: number;
}

export interface CommitRow {
  sha: string;
  author?: string;
  message?: string;
  timestamp?: number;
}

/** Manages the SQLite index database with migrations and prepared statements. */
export class IndexStore {
  private db: Database.Database;
  private stmtCache = new Map<string, Database.Statement>();

  /** Open (or create) the index database and run pending migrations. */
  static open(dbPath: string): IndexStore {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    const store = new IndexStore(db);
    store.runMigrations();
    return store;
  }

  private constructor(db: Database.Database) {
    this.db = db;
  }

  /** Close the underlying database connection. */
  close(): void {
    this.db.close();
  }

  /** Execute a function inside a transaction. */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /** Current schema version from PRAGMA user_version. */
  getSchemaVersion(): number {
    const row = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
    return row.user_version;
  }

  private runMigrations(): void {
    const migrationsDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migrationsDir)) return;
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const versions = files
      .map((f) => parseInt(f.match(/^(\d+)/)?.[1] ?? "0", 10))
      .filter((v) => v > 0);
    const latestVersion = versions.length ? Math.max(...versions) : 0;
    const currentVersion = this.getSchemaVersion();
    if (currentVersion > latestVersion) {
      throw new Error("DB schema version " + currentVersion + " is newer than supported (" + latestVersion + "). Run vibeguide_index_clear to rebuild.");
    }
    for (const file of files) {
      const versionMatch = file.match(/^(\d+)/);
      const version = versionMatch ? parseInt(versionMatch[1], 10) : 0;
      if (version > currentVersion) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        this.db.exec(sql);
        this.db.pragma(`user_version = ${version}`);
      }
    }
  }

  private stmt(sql: string): Database.Statement {
    if (!this.stmtCache.has(sql)) {
      this.stmtCache.set(sql, this.db.prepare(sql));
    }
    return this.stmtCache.get(sql)!;
  }

  /** Upsert a file row (insert or replace). */
  upsertFile(row: FileRow): void {
    this.stmt(
      "INSERT OR REPLACE INTO files (path, git_oid, language, lines, last_indexed_at) VALUES (?, ?, ?, ?, ?)"
    ).run(row.path, row.git_oid, row.language ?? null, row.lines ?? null, row.last_indexed_at ?? Date.now());
  }

  /** Delete imports for a file before re-inserting. */
  deleteImportsForFile(filePath: string): void {
    this.stmt("DELETE FROM imports WHERE from_file = ?").run(filePath);
  }

  /** Insert an import row. */
  upsertImport(row: ImportRow): void {
    this.stmt("INSERT INTO imports (from_file, to_file, specifier) VALUES (?, ?, ?)")
      .run(row.from_file, row.to_file, row.specifier ?? null);
  }

  /** Delete exports for a file before re-inserting. */
  deleteExportsForFile(filePath: string): void {
    this.stmt("DELETE FROM exports WHERE file = ?").run(filePath);
  }

  /** Insert an export row. */
  upsertExport(row: ExportRow): void {
    this.stmt("INSERT INTO exports (file, symbol, kind, line) VALUES (?, ?, ?, ?)")
      .run(row.file, row.symbol, row.kind ?? null, row.line ?? null);
  }

  /** Delete symbols for a file before re-inserting. */
  deleteSymbolsForFile(filePath: string): void {
    this.stmt("DELETE FROM symbols WHERE file = ?").run(filePath);
  }

  /** Insert a symbol row. */
  upsertSymbol(row: SymbolRow): void {
    this.stmt("INSERT INTO symbols (file, name, kind, line, scope) VALUES (?, ?, ?, ?, ?)")
      .run(row.file, row.name, row.kind ?? null, row.line ?? null, row.scope ?? null);
  }

  /** Delete ownership for a file before re-inserting. */
  deleteOwnershipForFile(filePath: string): void {
    this.stmt("DELETE FROM ownership WHERE file = ?").run(filePath);
  }

  /** Insert an ownership row. */
  upsertOwnership(row: OwnershipRow): void {
    this.stmt("INSERT INTO ownership (file, author, commits, last_touch) VALUES (?, ?, ?, ?)")
      .run(row.file, row.author, row.commits ?? null, row.last_touch ?? null);
  }

  /** Upsert a commit row (insert or replace). */
  upsertCommit(row: CommitRow): void {
    this.stmt("INSERT OR REPLACE INTO commits (sha, author, message, timestamp) VALUES (?, ?, ?, ?)")
      .run(row.sha, row.author ?? null, row.message ?? null, row.timestamp ?? null);
  }

  /** Insert an embedding row. */
  upsertEmbedding(file: string, chunk_id: number, vector: Buffer): void {
    this.stmt("INSERT OR REPLACE INTO embeddings (file, chunk_id, vector) VALUES (?, ?, ?)")
      .run(file, chunk_id, vector);
  }

  /** Get stored file ? OID map. */
  getFileOids(): Map<string, string> {
    const rows = this.stmt("SELECT path, git_oid FROM files").all() as Array<{ path: string; git_oid: string }>;
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.path, r.git_oid);
    return map;
  }

  /** Delete a file and its cascaded rows. */
  deleteFile(filePath: string): void {
    this.stmt("DELETE FROM files WHERE path = ?").run(filePath);
  }

  /** Count indexed files. */
  countFiles(): number {
    const row = this.stmt("SELECT COUNT(*) as c FROM files").get() as { c: number };
    return row.c;
  }

  /** Get last indexed timestamp. */
  getLastIndexedAt(): number | undefined {
    const row = this.stmt("SELECT MAX(last_indexed_at) as m FROM files").get() as { m: number | null };
    return row.m ?? undefined;
  }

  /** Check if a file exists in the index. */
  hasFile(filePath: string): boolean {
    const row = this.stmt("SELECT 1 FROM files WHERE path = ?").get(filePath) as { "1": number } | undefined;
    return !!row;
  }
/** Count imports originating from a file. */
  countImportsFrom(filePath: string): number {
    const row = this.stmt("SELECT COUNT(*) as c FROM imports WHERE from_file = ?").get(filePath) as { c: number };
    return row.c;
  }

  /** Count exports for a file. */
  countExportsOf(filePath: string): number {
    const row = this.stmt("SELECT COUNT(*) as c FROM exports WHERE file = ?").get(filePath) as { c: number };
    return row.c;
  }

  /** Count symbols for a file. */
  countSymbolsOf(filePath: string): number {
    const row = this.stmt("SELECT COUNT(*) as c FROM symbols WHERE file = ?").get(filePath) as { c: number };
    return row.c;
  }

  /** Return all indexed file paths. */
  getAllFiles(): string[] {
    const rows = this.stmt("SELECT path FROM files").all() as Array<{ path: string }>;
    return rows.map((r) => r.path);
  }

  /** Return all import edges. */
  getAllImports(): Array<{ from_file: string; to_file: string }> {
    return this.stmt("SELECT from_file, to_file FROM imports").all() as Array<{ from_file: string; to_file: string }>;
  }

  /** Return files that import the given file (reverse dependencies). */
  getDependents(filePath: string): string[] {
    const rows = this.stmt("SELECT from_file FROM imports WHERE to_file = ?").all(filePath) as Array<{ from_file: string }>;
    return [...new Set(rows.map((r) => r.from_file))];
  }

  /** Return files that the given file imports (forward dependencies). */
  getDependencies(filePath: string): string[] {
    const rows = this.stmt("SELECT to_file FROM imports WHERE from_file = ?").all(filePath) as Array<{ to_file: string }>;
    return [...new Set(rows.map((r) => r.to_file))];
  }
  /** Delete all files and cascaded rows (full rebuild). */
  deleteAllFiles(): void {
    this.stmt("DELETE FROM files").run();
  }


  /** Read the stored repo signature from meta. */
  getMetaSignature(): string | undefined {
    const row = this.stmt("SELECT value FROM meta WHERE key = 'repo_signature'").get() as { value: string } | undefined;
    return row?.value;
  }

  /** Write the repo signature to meta. */
  setMetaSignature(sig: string): void {
    this.stmt("INSERT OR REPLACE INTO meta (key, value) VALUES ('repo_signature', ?)").run(sig);
  }
}

