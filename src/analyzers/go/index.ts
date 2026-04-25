/** Go import/export analyzer for module-aware dependency graph construction. */
import * as path from "path";
import type { Analyzer, ExportRef, ImportRef, SourceFile } from "../spi.js";

const GO_EXTENSIONS = [".go"];
const importBlockRegex = /\bimport\s*\(([\s\S]*?)\)/g;
const quotedImportRegex = /^\s*(?:[._A-Za-z]\w*\s+)?["`]([^"`]+)["`]/gm;
const singleImportRegex = /^\s*import\s+(?:[._A-Za-z]\w*\s+)?["`]([^"`]+)["`]/gm;
const exportRegex = /^\s*(?:func|type|var|const)\s+([A-Z]\w*)/gm;

/** Analyzer for Go source files and import blocks. */
export const goAnalyzer: Analyzer = {
  language: "go",
  extensions: GO_EXTENSIONS,
  detect(filePath: string): boolean {
    return GO_EXTENSIONS.includes(path.extname(filePath));
  },
  parseImports(file: SourceFile): ImportRef[] {
    const code = stripGoComments(file.content);
    const imports = parseImportBlocks(code);
    const withoutBlocks = code.replace(importBlockRegex, "");
    let match: RegExpExecArray | null;
    singleImportRegex.lastIndex = 0;
    while ((match = singleImportRegex.exec(withoutBlocks)) !== null) {
      imports.push({ specifier: match[1], kind: "static" });
    }
    return imports;
  },
  parseExports(file: SourceFile): ExportRef[] {
    const exports: ExportRef[] = [];
    const code = stripGoComments(file.content);
    let match: RegExpExecArray | null;
    exportRegex.lastIndex = 0;
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push({ name: match[1], kind: "named" });
    }
    return exports;
  },
};

function parseImportBlocks(code: string): ImportRef[] {
  const imports: ImportRef[] = [];
  let blockMatch: RegExpExecArray | null;
  importBlockRegex.lastIndex = 0;
  while ((blockMatch = importBlockRegex.exec(code)) !== null) {
    let importMatch: RegExpExecArray | null;
    quotedImportRegex.lastIndex = 0;
    while ((importMatch = quotedImportRegex.exec(blockMatch[1])) !== null) {
      imports.push({ specifier: importMatch[1], kind: "static" });
    }
  }
  return imports;
}

function stripGoComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

export { goTreeSitterAnalyzer } from "./treeSitterAnalyzer.js";
