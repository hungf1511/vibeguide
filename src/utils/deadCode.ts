/** Tìm export không được import và file orphan (không có import/export). */
import type { DeadCodeResult } from "../types.js";
import { getAllSourceFiles, scanDependencies } from "./scanner.js";
import { readSafe } from "./readSafe.js";

export function findDeadCode(repo: string): DeadCodeResult {
  const allFiles = getAllSourceFiles(repo);
  const exportRegex = /export\s+(?:async\s+)?(?:function|const|class|interface|type|enum|let|var)\s+(\w+)/g;
  const namedReexportRegex = /export\s+\{([^}]+)\}/g;
  const fileExports = new Map<string, string[]>();

  for (const file of allFiles) {
    const content = readSafe(repo, file);
    if (!content) continue;
    const list: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = exportRegex.exec(content)) !== null) list.push(m[1]);
    while ((m = namedReexportRegex.exec(content)) !== null) {
      for (const part of m[1].split(",")) {
        const trimmed = part.trim().split(/\s+as\s+/)[0].trim();
        if (trimmed) list.push(trimmed);
      }
    }
    if (list.length > 0) fileExports.set(file, list);
    exportRegex.lastIndex = 0;
    namedReexportRegex.lastIndex = 0;
  }

  const importedNames = new Set<string>();
  const importRegex = /import\s+(?:type\s+)?(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))(?:\s*,\s*\{([^}]+)\})?\s+from\s+["'][^"']+["']/g;
  for (const file of allFiles) {
    const content = readSafe(repo, file);
    if (!content) continue;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(content)) !== null) {
      if (m[1]) importedNames.add(m[1]);
      if (m[2]) for (const p of m[2].split(",")) importedNames.add(p.trim().split(/\s+as\s+/)[0].trim());
      if (m[3]) importedNames.add(m[3]);
      if (m[4]) for (const p of m[4].split(",")) importedNames.add(p.trim().split(/\s+as\s+/)[0].trim());
    }
    importRegex.lastIndex = 0;
  }

  const unused: { file: string; symbol: string }[] = [];
  for (const [file, exports] of fileExports) {
    for (const sym of exports) {
      if (sym === "default") continue;
      if (!importedNames.has(sym)) unused.push({ file, symbol: sym });
    }
  }

  const graph = scanDependencies(repo);
  const incoming = new Set<string>();
  const outgoing = new Set<string>();
  for (const e of graph.edges) {
    incoming.add(e.to);
    outgoing.add(e.from);
  }
  const orphans = graph.nodes.filter((n) => !incoming.has(n) && !outgoing.has(n));

  const summary = unused.length + " export khong duoc import (" + orphans.length + " file orphan).";
  return {
    unusedExports: unused.slice(0, 30),
    orphanFiles: orphans.slice(0, 30),
    summary,
  };
}
