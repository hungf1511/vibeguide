/** Queries implementation that reads from a pre-built SQLite index. Returned by getQueries() when signature matches. */
import * as path from "path";
import type { DepGraph, DepEdge } from "../../types.js";
import type { FileScope } from "../../core/git/index.js";
import { IndexStore } from "../store.js";
import type { Queries } from "./types.js";

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".py", ".go", ".rs", ".java", ".kt", ".swift"]);

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTS.has(path.extname(filePath));
}

function matchScope(file: string, allowed: Set<string>): boolean {
  for (const s of allowed) {
    if (!path.extname(s)) {
      // folder prefix
      if (file === s || file.startsWith(s + "/")) return true;
    } else if (file === s) {
      return true;
    }
  }
  return false;
}

export class SqliteQueries implements Queries {
  constructor(private store: IndexStore, private repoPath: string) {}

  async getDependencyGraph(scope?: FileScope): Promise<DepGraph> {
    const nodes = this.store.getAllFiles().filter(isSourceFile);
    const rows = this.store.getAllImports();
    let edges: DepEdge[] = rows.map((r) => ({ from: r.from_file, to: r.to_file }));

    if (scope?.paths?.length) {
      const allowed = new Set(scope.paths);
      const filteredNodes = nodes.filter((n) => matchScope(n, allowed));
      const filteredEdges = edges.filter((e) => matchScope(e.from, allowed) || matchScope(e.to, allowed));
      return { nodes: filteredNodes, edges: filteredEdges };
    }

    return { nodes, edges };
  }

  async getDependents(file: string): Promise<string[]> {
    return this.store.getDependents(file);
  }

  async getDependencies(file: string): Promise<string[]> {
    return this.store.getDependencies(file);
  }

  /** Close the underlying store connection. */
  close(): void {
    this.store.close();
  }
}
