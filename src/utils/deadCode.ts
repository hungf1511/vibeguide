/** Tìm export không được import và file orphan (không có import/export). */
import type { DeadCodeResult } from "../types.js";
import { getAllSourceFiles, scanDependencies } from "./scanner.js";
import { readSafe } from "./readSafe.js";
import { stripNonCode } from "./codeText.js";

export function findDeadCode(repo: string): DeadCodeResult {
  const allFiles = getAllSourceFiles(repo);
  const exportRegex = /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function|const|class|interface|type|enum|let|var)\s+([A-Za-z_$][\w$]*)/g;
  const namedReexportRegex = /\bexport\s+(?:type\s+)?\{([^}]+)\}(?:\s+from\b)?/g;
  const fileExports = new Map<string, string[]>();
  const codeByFile = new Map<string, string>();

  for (const file of allFiles) {
    const content = readSafe(repo, file);
    if (!content) continue;
    const code = stripNonCode(content);
    codeByFile.set(file, code);
    const list: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = exportRegex.exec(code)) !== null) list.push(m[1]);
    while ((m = namedReexportRegex.exec(code)) !== null) {
      for (const part of m[1].split(",")) {
        const trimmed = getExportedSpecifierName(part);
        if (trimmed) list.push(trimmed);
      }
    }
    if (list.length > 0) fileExports.set(file, list);
    exportRegex.lastIndex = 0;
    namedReexportRegex.lastIndex = 0;
  }

  const importedNames = new Set<string>();
  const importRegex = /\bimport\s+(?:type\s+)?([^;]+?)\s+from\b/g;
  for (const file of allFiles) {
    const content = codeByFile.get(file);
    if (!content) continue;
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(content)) !== null) {
      addImportedNames(importedNames, m[1]);
    }
    importRegex.lastIndex = 0;
  }

  const unused: { file: string; symbol: string }[] = [];
  for (const [file, exports] of fileExports) {
    const code = codeByFile.get(file) || "";
    for (const sym of exports) {
      if (sym === "default") continue;
      if (isReferencedInSameFile(code, sym)) continue;
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

function addImportedNames(importedNames: Set<string>, specifier: string): void {
  const trimmed = specifier.trim();
  if (!trimmed || trimmed.startsWith("\"") || trimmed.startsWith("'")) return;

  if (trimmed.startsWith("{")) {
    addNamedSpecifiers(importedNames, trimmed);
    return;
  }

  const namespaceMatch = trimmed.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceMatch) {
    importedNames.add(namespaceMatch[1]);
    return;
  }

  const commaIndex = trimmed.indexOf(",");
  if (commaIndex === -1) {
    const defaultName = trimmed.match(/^([A-Za-z_$][\w$]*)/);
    if (defaultName) importedNames.add(defaultName[1]);
    return;
  }

  const defaultPart = trimmed.slice(0, commaIndex).trim();
  if (defaultPart) importedNames.add(defaultPart);
  addNamedSpecifiers(importedNames, trimmed.slice(commaIndex + 1));
}

function addNamedSpecifiers(importedNames: Set<string>, specifier: string): void {
  const block = specifier.replace(/^\{|\}$/g, "");
  for (const part of block.split(",")) {
    const originalName = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
    if (originalName) importedNames.add(originalName);
  }
}

function getExportedSpecifierName(part: string): string {
  const pieces = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
  return (pieces[1] || pieces[0] || "").trim();
}

function isReferencedInSameFile(code: string, symbol: string): boolean {
  const token = new RegExp("\\b" + escapeRegex(symbol) + "\\b", "g");
  const matches = code.match(token);
  return (matches?.length || 0) > 1;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
