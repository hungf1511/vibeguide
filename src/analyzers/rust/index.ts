/** Rust import/export analyzer for local module graph construction. */
import * as path from "path";
import type { Analyzer, ExportRef, ImportRef, SourceFile } from "../spi.js";

const RUST_EXTENSIONS = [".rs"];
const modRegex = /^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_]\w*)\s*;/gm;
const useRegex = /^\s*(?:pub\s+)?use\s+([^;]+);/gm;
const exportRegex = /^\s*pub(?:\([^)]*\))?\s+(?:async\s+)?(?:fn|struct|enum|trait|type|const|static|mod)\s+([A-Za-z_]\w*)/gm;

/** Analyzer for Rust modules, crate-relative uses, and public symbols. */
export const rustAnalyzer: Analyzer = {
  language: "rust",
  extensions: RUST_EXTENSIONS,
  detect(filePath: string): boolean {
    return RUST_EXTENSIONS.includes(path.extname(filePath));
  },
  parseImports(file: SourceFile): ImportRef[] {
    const code = stripRustComments(file.content);
    const imports: ImportRef[] = [];
    let match: RegExpExecArray | null;

    modRegex.lastIndex = 0;
    while ((match = modRegex.exec(code)) !== null) {
      imports.push({ specifier: `./${match[1]}`, kind: "static" });
    }

    useRegex.lastIndex = 0;
    while ((match = useRegex.exec(code)) !== null) {
      for (const specifier of expandUsePath(match[1])) {
        imports.push({ specifier, kind: "static" });
      }
    }

    return imports;
  },
  parseExports(file: SourceFile): ExportRef[] {
    const exports: ExportRef[] = [];
    const code = stripRustComments(file.content);
    let match: RegExpExecArray | null;
    exportRegex.lastIndex = 0;
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push({ name: match[1], kind: "named" });
    }
    return exports;
  },
};

function expandUsePath(rawPath: string): string[] {
  const normalized = rawPath.trim().replace(/\s+as\s+\w+$/i, "");
  const braceMatch = normalized.match(/^(.*)::\{(.+)\}$/s);
  if (!braceMatch) {
    return isLocalRustPath(normalized) ? [normalized] : [];
  }

  const prefix = braceMatch[1].trim();
  if (!isLocalRustPath(prefix)) return [];
  const items = braceMatch[2].split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return [prefix];
  return items.map((item) => item === "self" ? prefix : `${prefix}::${item.replace(/\s+as\s+\w+$/i, "")}`);
}

function isLocalRustPath(specifier: string): boolean {
  return /^(crate|self|super)::/.test(specifier);
}

function stripRustComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

export { rustTreeSitterAnalyzer } from "./treeSitterAnalyzer.js";
