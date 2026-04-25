/** IndexBuilder � scan repo into SQLite with full or incremental builds. */
import * as fs from "fs";
import * as path from "path";
import { IndexStore } from "./store.js";
import { runGit, isGitRepo } from "../core/git/runGit.js";
import { getLog } from "../core/git/log.js";
import { getAnalyzerForFile, createSourceFile } from "../analyzers/registry.js";
import { loadPathAliases, resolveImportSpecifier } from "../analyzers/resolution.js";
import { loadConfig } from "../utils/configLoader.js";
import { normalizePath, getRepoSignature } from "../utils/scanner.js";
import type { ImportRef, ExportRef, SymbolRef } from "../analyzers/spi.js";

export interface BuildStats {
  filesIndexed: number;
  importsIndexed: number;
  exportsIndexed: number;
  symbolsIndexed: number;
  commitsIndexed: number;
  durationMs: number;
}

/** Build or update the SQLite index for a repository. */
export class IndexBuilder {
  constructor(private store: IndexStore, private repoPath: string) {}

  /** Scan all files and populate the index from scratch. */
  async buildFull(): Promise<BuildStats> {
    if (!isGitRepo(this.repoPath)) {
      throw new Error("Index requires a git repository");
    }
    const start = Date.now();
    const stats: BuildStats = {
      filesIndexed: 0,
      importsIndexed: 0,
      exportsIndexed: 0,
      symbolsIndexed: 0,
      commitsIndexed: 0,
      durationMs: 0,
    };

    const gitFiles = this.getGitFileOids();
    const config = loadConfig(this.repoPath);
    const analyzerOptions = {
      backend: config.parser.backend,
      legacyParser: config.parser.legacyParser,
    };
    const aliases = loadPathAliases(this.repoPath);
    const fileList = Array.from(gitFiles.keys());
    const fileSet = new Set<string>(fileList);

    // Clear existing index before full rebuild
    this.store.transaction(() => {
      this.store.deleteAllFiles();
    });

    for (const filePath of fileList) {
      const result = await this.indexFile(filePath, gitFiles.get(filePath)!, analyzerOptions, aliases, fileSet);
      stats.filesIndexed++;
      stats.importsIndexed += result.imports;
      stats.exportsIndexed += result.exports;
      stats.symbolsIndexed += result.symbols;
    }

    const commits = getLog(this.repoPath, 1000);
    this.store.transaction(() => {
      for (const c of commits) {
        this.store.upsertCommit({
          sha: c.sha,
          author: c.author,
          message: c.message,
          timestamp: c.date ? new Date(c.date).getTime() : undefined,
        });
      }
    });
    stats.commitsIndexed = commits.length;

    this.store.setMetaSignature(getRepoSignature(this.repoPath));
    stats.durationMs = Date.now() - start;
    return stats;
  }

  /** Compare git OIDs and only re-index changed / added / deleted files. */
  async buildIncremental(): Promise<BuildStats> {
    if (!isGitRepo(this.repoPath)) {
      throw new Error("Index requires a git repository");
    }
    const start = Date.now();
    const stats: BuildStats = {
      filesIndexed: 0,
      importsIndexed: 0,
      exportsIndexed: 0,
      symbolsIndexed: 0,
      commitsIndexed: 0,
      durationMs: 0,
    };

    const currentOids = this.getGitFileOids();
    const storedOids = this.store.getFileOids();
    const config = loadConfig(this.repoPath);
    const analyzerOptions = {
      backend: config.parser.backend,
      legacyParser: config.parser.legacyParser,
    };
    const aliases = loadPathAliases(this.repoPath);

    const changed: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];

    for (const [filePath, currentOid] of currentOids) {
      const storedOid = storedOids.get(filePath);
      if (storedOid === undefined) {
        added.push(filePath);
      } else if (storedOid !== currentOid) {
        changed.push(filePath);
      }
    }
    for (const filePath of storedOids.keys()) {
      if (!currentOids.has(filePath)) {
        deleted.push(filePath);
      }
    }

    // Delete removed files first (cascade via FK)
    this.store.transaction(() => {
      for (const filePath of deleted) {
        this.store.deleteFile(filePath);
      }
    });

    // Re-index changed + added
    const toReindex = [...changed, ...added];
    const fileSet = new Set<string>(Array.from(currentOids.keys()));
    for (const filePath of toReindex) {
      const result = await this.indexFile(filePath, currentOids.get(filePath)!, analyzerOptions, aliases, fileSet);
      stats.filesIndexed++;
      stats.importsIndexed += result.imports;
      stats.exportsIndexed += result.exports;
      stats.symbolsIndexed += result.symbols;
    }

    const commits = getLog(this.repoPath, 1000);
    this.store.transaction(() => {
      for (const c of commits) {
        this.store.upsertCommit({
          sha: c.sha,
          author: c.author,
          message: c.message,
          timestamp: c.date ? new Date(c.date).getTime() : undefined,
        });
      }
    });
    stats.commitsIndexed = commits.length;

    this.store.setMetaSignature(getRepoSignature(this.repoPath));
    stats.durationMs = Date.now() - start;
    return stats;
  }

  /** Parse and store a single file into the index. */
  private async indexFile(
    filePath: string,
    gitOid: string,
    analyzerOptions: { backend: "static" | "tree-sitter"; legacyParser: boolean },
    aliases: ReturnType<typeof loadPathAliases>,
    fileSet?: Set<string>
  ): Promise<{ imports: number; exports: number; symbols: number }> {
    const fullPath = path.join(this.repoPath, filePath);
    let content = "";
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      return { imports: 0, exports: 0, symbols: 0 };
    }

    const lines = content.split("\n").length;
    const ext = path.extname(filePath);
    const lang = extToLanguage(ext);

    this.store.upsertFile({
      path: filePath,
      git_oid: gitOid,
      language: lang,
      lines,
      last_indexed_at: Date.now(),
    });

    const analyzer = getAnalyzerForFile(filePath, content, analyzerOptions);
    if (!analyzer) {
      return { imports: 0, exports: 0, symbols: 0 };
    }

    const sourceFile = createSourceFile(this.repoPath, filePath, content);
    const imports = await analyzer.parseImports(sourceFile);
    const exports = analyzer.parseExports ? await analyzer.parseExports(sourceFile) : [];
    const symbols = analyzer.parseSymbols ? analyzer.parseSymbols(sourceFile) : [];

    this.store.transaction(() => {
      this.store.deleteImportsForFile(filePath);
      for (const imp of imports) {
        const resolved = resolveImportSpecifier(filePath, imp.specifier, aliases, this.repoPath, {
          language: analyzer.language,
        });
        if (resolved && fileSet?.has(resolved)) {
          this.store.upsertImport({
            from_file: filePath,
            to_file: resolved,
            specifier: imp.specifier,
          });
        }
      }

      this.store.deleteExportsForFile(filePath);
      for (const exp of exports) {
        this.store.upsertExport({
          file: filePath,
          symbol: exp.name,
          kind: exp.kind,
        });
      }

      this.store.deleteSymbolsForFile(filePath);
      for (const sym of symbols) {
        this.store.upsertSymbol({
          file: filePath,
          name: sym.name,
          kind: sym.kind,
          line: sym.line,
          scope: undefined,
        });
      }
    });

    return { imports: imports.length, exports: exports.length, symbols: symbols.length };
  }

  /** Run git ls-tree to get file ? OID map. */
  private getGitFileOids(): Map<string, string> {
    const output = runGit(this.repoPath, ["ls-tree", "-r", "HEAD"]);
    const map = new Map<string, string>();
    for (const line of output.replace(/\r\n/g, "\n").split("\n")) {
      if (!line.trim()) continue;
      // Format: "100644 blob abc123\tpath/to/file.ts"
      const tabIdx = line.indexOf("\t");
      if (tabIdx < 0) continue;
      const meta = line.slice(0, tabIdx).split(" ");
      const sha = meta[2];
      const filePath = normalizePath(line.slice(tabIdx + 1));
      if (sha && filePath) {
        map.set(filePath, sha);
      }
    }
    return map;
  }
}

function extToLanguage(ext: string): string | undefined {
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
  };
  return map[ext];
}
