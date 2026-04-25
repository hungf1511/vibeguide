/** Tim export khong duoc import va file orphan (khong co import/export). */
import type { DeadCodeResult } from "../types.js";
import { getAllSourceFiles, scanDependencies } from "./scanner.js";
import { readSafe } from "./readSafe.js";
import { stripNonCode } from "./codeText.js";

interface DeadCodeScanState {
  fileExports: Map<string, string[]>;
  codeByFile: Map<string, string>;
}

/** Find unused exports and files with no inbound references. */
export async function findDeadCode(repo: string): Promise<DeadCodeResult> {
  const allFiles = getAllSourceFiles(repo);
  const { fileExports, codeByFile } = collectCodeAndExports(repo, allFiles);
  const importedNames = collectImportedNames(allFiles, codeByFile);
  const unused = collectUnusedExports(fileExports, codeByFile, importedNames);
  const orphans = await (collectOrphanFiles(repo));

  return {
    unusedExports: unused.slice(0, 30),
    orphanFiles: orphans.slice(0, 30),
    summary: unused.length + " export khong duoc import (" + orphans.length + " file orphan).",
  };
}

function collectCodeAndExports(repo: string, allFiles: string[]): DeadCodeScanState {
  const fileExports = new Map<string, string[]>();
  const codeByFile = new Map<string, string>();

  for (const file of allFiles) {
    const content = readSafe(repo, file);
    if (!content) continue;

    const code = stripNonCode(content);
    const exports = collectExportNames(code);
    codeByFile.set(file, code);
    if (exports.length > 0) fileExports.set(file, exports);
  }

  return { fileExports, codeByFile };
}

function collectExportNames(code: string): string[] {
  const exportRegex = /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(?:function|const|class|interface|type|enum|let|var)\s+([A-Za-z_$][\w$]*)/g;
  const namedReexportRegex = /\bexport\s+(?:type\s+)?\{([^}]+)\}(?:\s+from\b)?/g;
  const list: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = exportRegex.exec(code)) !== null) list.push(match[1]);
  while ((match = namedReexportRegex.exec(code)) !== null) {
    for (const part of match[1].split(",")) {
      const name = getExportedSpecifierName(part);
      if (name) list.push(name);
    }
  }

  return list;
}

function collectImportedNames(allFiles: string[], codeByFile: Map<string, string>): Set<string> {
  const importedNames = new Set<string>();
  const importRegex = /\bimport\s+(?:type\s+)?([^;]+?)\s+from\b/g;

  for (const file of allFiles) {
    const content = codeByFile.get(file);
    if (!content) continue;

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) addImportedNames(importedNames, match[1]);
    importRegex.lastIndex = 0;
  }

  return importedNames;
}

function collectUnusedExports(fileExports: Map<string, string[]>, codeByFile: Map<string, string>, importedNames: Set<string>): { file: string; symbol: string }[] {
  const unused: { file: string; symbol: string }[] = [];

  for (const [file, exports] of fileExports) {
    const code = codeByFile.get(file) || "";
    for (const sym of exports) {
      if (sym === "default") continue;
      if (isReferencedInSameFile(code, sym)) continue;
      if (!importedNames.has(sym)) unused.push({ file, symbol: sym });
    }
  }

  return unused;
}

async function collectOrphanFiles(repo: string): Promise<string[]> {
  const graph = await (scanDependencies(repo));
  const incoming = new Set<string>();
  const outgoing = new Set<string>();

  for (const edge of graph.edges) {
    incoming.add(edge.to);
    outgoing.add(edge.from);
  }

  return graph.nodes.filter((node) => !incoming.has(node) && !outgoing.has(node));
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
