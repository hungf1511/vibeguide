/** Queries implementation that scans the repo at query time. Used as fallback when SQLite index missing or stale. */
import type { DepGraph } from "../../types.js";
import type { FileScope } from "../../core/git/index.js";
import { scanDependencies } from "../../utils/scanner.js";
import type { Queries } from "./types.js";

export class InMemoryQueries implements Queries {
  constructor(private repoPath: string) {}

  async getDependencyGraph(scope?: FileScope): Promise<DepGraph> {
    try {
      return await scanDependencies(this.repoPath, scope);
    } catch {
      return { nodes: [], edges: [] };
    }
  }

  async getDependents(file: string): Promise<string[]> {
    try {
      const graph = await scanDependencies(this.repoPath);
      const deps = graph.edges.filter((e) => e.to === file).map((e) => e.from);
      return [...new Set(deps)];
    } catch {
      return [];
    }
  }

  async getDependencies(file: string): Promise<string[]> {
    try {
      const graph = await scanDependencies(this.repoPath);
      const deps = graph.edges.filter((e) => e.from === file).map((e) => e.to);
      return [...new Set(deps)];
    } catch {
      return [];
    }
  }
  /** No-op close for in-memory queries. */
  close(): void {}
}

