import * as path from "path";

/** Resolve a path safely within repo boundaries. */
export function resolveSafe(targetPath: string, repoPath?: string): string {
  const base = repoPath ? path.resolve(repoPath) : process.cwd();
  const resolved = path.resolve(base, targetPath);

  // Null byte check
  if (resolved.includes("\0")) {
    throw new Error("Invalid path: contains null byte");
  }

  // Path traversal guard
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    if (!resolved.startsWith(base)) {
      throw new Error("Path traversal detected");
    }
  }

  return resolved;
}

/** Resolve repo path or default to cwd. */
export function resolveRepo(repoPath?: string): string {
  const repo = repoPath ? path.resolve(repoPath) : process.cwd();

  if (repo.includes("\0")) {
    throw new Error("Invalid repo path: contains null byte");
  }

  return repo;
}
