/** Rust module path resolver for crate/self/super imports. */
import * as fs from "fs";
import * as path from "path";

/** Resolve a Rust local import into a repo-relative .rs module path. */
export function resolveRustImport(fromFile: string, imported: string, baseDir: string): string | null {
  if (imported.startsWith("./")) {
    return resolveRustModule(path.resolve(baseDir, getRustModuleDir(fromFile), imported.slice(2)), baseDir);
  }

  if (imported.startsWith("crate::")) {
    const crateRoot = fromFile.startsWith("src/") ? path.join(baseDir, "src") : baseDir;
    return resolveRustSegments(crateRoot, imported.slice("crate::".length).split("::"), baseDir);
  }

  if (imported.startsWith("self::") || imported.startsWith("super::")) {
    return resolveRustRelative(fromFile, imported, baseDir);
  }

  return null;
}

function resolveRustRelative(fromFile: string, imported: string, baseDir: string): string | null {
  const parts = imported.split("::");
  let current = path.resolve(baseDir, getRustModuleDir(fromFile));
  while (parts[0] === "super") {
    current = path.dirname(current);
    parts.shift();
  }
  if (parts[0] === "self") parts.shift();
  return resolveRustSegments(current, parts, baseDir);
}

function resolveRustSegments(root: string, segments: string[], baseDir: string): string | null {
  for (let size = segments.length; size > 0; size--) {
    const resolved = resolveRustModule(path.join(root, ...segments.slice(0, size)), baseDir);
    if (resolved) return resolved;
  }
  return null;
}

function resolveRustModule(candidate: string, baseDir: string): string | null {
  return resolvePath(candidate, baseDir, [".rs"], ["mod.rs"]);
}

function getRustModuleDir(fromFile: string): string {
  const dir = path.dirname(fromFile);
  const base = path.basename(fromFile, ".rs");
  return ["lib", "main", "mod"].includes(base) ? dir : path.join(dir, base);
}

function resolvePath(resolved: string, baseDir: string, extensions: string[], indexFiles: string[]): string | null {
  if (isFile(resolved)) return toRepoPath(resolved, baseDir);
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (isFile(withExt)) return toRepoPath(withExt, baseDir);
  }
  if (isDirectory(resolved)) {
    for (const indexFile of indexFiles) {
      const indexPath = path.join(resolved, indexFile);
      if (isFile(indexPath)) return toRepoPath(indexPath, baseDir);
    }
  }
  return null;
}

function isFile(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function isDirectory(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
}

function toRepoPath(filePath: string, baseDir: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, "/");
}
