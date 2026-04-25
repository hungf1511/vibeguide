/** Static Python import/export analyzer for dependency graph construction. */
import * as path from "path";
import type { Analyzer, ExportRef, ImportRef, SourceFile } from "../spi.js";

const PYTHON_EXTENSIONS = [".py"];
const importLineRegex = /^\s*import\s+(.+)$/gm;
const fromLineRegex = /^\s*from\s+([.\w]+)\s+import\s+(.+)$/gm;
const exportRegex = /^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)/gm;

/** Regex/static analyzer kept as a stable fallback for parser backend rollback. */
export const staticPythonAnalyzer: Analyzer = {
  language: "python",
  extensions: PYTHON_EXTENSIONS,
  detect(filePath: string): boolean {
    return PYTHON_EXTENSIONS.includes(path.extname(filePath));
  },
  parseImports(file: SourceFile): ImportRef[] {
    const code = stripPythonComments(file.content);
    return [...parseImportLines(code), ...parseFromLines(code)];
  },
  parseExports(file: SourceFile): ExportRef[] {
    const exports: ExportRef[] = [];
    const code = stripPythonComments(file.content);
    let match: RegExpExecArray | null;
    exportRegex.lastIndex = 0;
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push({ name: match[1], kind: "named" });
    }
    return exports;
  },
};

function parseImportLines(code: string): ImportRef[] {
  const imports: ImportRef[] = [];
  let match: RegExpExecArray | null;
  importLineRegex.lastIndex = 0;
  while ((match = importLineRegex.exec(code)) !== null) {
    for (const part of match[1].split(",")) {
      const specifier = part.trim().split(/\s+as\s+/i)[0]?.trim();
      if (specifier) imports.push({ specifier, kind: "static" });
    }
  }
  return imports;
}

function parseFromLines(code: string): ImportRef[] {
  const imports: ImportRef[] = [];
  let match: RegExpExecArray | null;
  fromLineRegex.lastIndex = 0;
  while ((match = fromLineRegex.exec(code)) !== null) {
    imports.push(...normalizeFromImport(match[1], match[2]));
  }
  return imports;
}

/** Convert Python from X import Y to specifier list, handling relative levels. */
export function normalizeFromImport(moduleName: string, names: string): ImportRef[] {
  const cleanNames = names.replace(/\([^)]*\)/g, "").split(",").map((name) => name.trim().split(/\s+as\s+/i)[0]).filter(Boolean);
  const dotMatch = moduleName.match(/^\.+/);
  if (!dotMatch) {
    return [{ specifier: moduleName, kind: "static" }];
  }

  const level = dotMatch[0].length;
  const rest = moduleName.slice(level).replace(/\./g, "/");
  const base = level === 1 ? "./" : "../".repeat(level - 1);
  if (rest) {
    return [{ specifier: `${base}${rest}`, kind: "static" }];
  }

  return cleanNames
    .filter((name) => name !== "*")
    .map((name) => ({ specifier: `${base}${name}`, kind: "static" }));
}

function stripPythonComments(content: string): string {
  return content
    .replace(/("""|''')[\s\S]*?\1/g, "")
    .replace(/(^|[^\\])#.*$/gm, "$1");
}
