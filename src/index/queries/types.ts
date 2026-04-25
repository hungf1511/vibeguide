/** Queries interface � abstraction over in-memory scanner vs SQLite index. */
import type { DepGraph } from "../../types.js";
import type { FileScope } from "../../core/git/index.js";

export interface Queries {
  /** Build the dependency graph for the repository. */
  getDependencyGraph(scope?: FileScope): Promise<DepGraph>;

  /** Return files that import the given file (reverse dependencies). */
  getDependents(file: string): Promise<string[]>;

  /** Return files that the given file imports (forward dependencies). */
  getDependencies(file: string): Promise<string[]>;

  /** Close any underlying resources (no-op for in-memory). */
  close?(): void;
}
