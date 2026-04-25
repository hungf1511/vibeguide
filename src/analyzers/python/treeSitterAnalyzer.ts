/** Tree-sitter WASM Python analyzer. Falls back at registry level via parser.backend. */
import * as path from "path";
import type { Analyzer, ExportRef, ImportRef, SourceFile } from "../spi.js";
import { parseWithTreeSitter, type SyntaxNode, visit } from "../treeSitterRuntime.js";
import { normalizeFromImport } from "./staticAnalyzer.js";

const PYTHON_EXTENSIONS = [".py"];

/** Analyzer backed by the Python tree-sitter grammar from VS Code's WASM bundle. */
export const pythonTreeSitterAnalyzer: Analyzer = {
  language: "python",
  extensions: PYTHON_EXTENSIONS,
  detect(filePath: string): boolean {
    return PYTHON_EXTENSIONS.includes(path.extname(filePath));
  },
  parseImports(file: SourceFile): Promise<ImportRef[]> {
    return parseWithTreeSitter("python", file.content, [], collectImports);
  },
  parseExports(file: SourceFile): Promise<ExportRef[]> {
    return parseWithTreeSitter("python", file.content, [], collectExports);
  },
};

function collectImports(root: SyntaxNode): ImportRef[] {
  const imports: ImportRef[] = [];
  visit(root, (node) => {
    if (node.type === "import_statement") imports.push(...parseImportStatement(node));
    if (node.type === "import_from_statement") imports.push(...parseFromImportStatement(node));
  });
  return imports;
}

function collectExports(root: SyntaxNode): ExportRef[] {
  const exports: ExportRef[] = [];
  visit(root, (node) => {
    if (node.type !== "function_definition" && node.type !== "class_definition") return;
    const name = node.childForFieldName("name")?.text.trim();
    if (name) exports.push({ name, kind: "named" });
  });
  return exports;
}

function parseImportStatement(node: SyntaxNode): ImportRef[] {
  return node.namedChildren
    .map((child) => importName(child))
    .filter((specifier): specifier is string => Boolean(specifier))
    .map((specifier) => ({ specifier, kind: "static" }));
}

function parseFromImportStatement(node: SyntaxNode): ImportRef[] {
  const moduleNode = node.childForFieldName("module_name") ?? node.namedChildren[0];
  const moduleName = moduleNode?.text.trim();
  if (!moduleName) return [];

  const importedNames = node.namedChildren
    .filter((child) => child.id !== moduleNode.id)
    .map((child) => importName(child))
    .filter((specifier): specifier is string => Boolean(specifier));
  return normalizeFromImport(moduleName, importedNames.join(","));
}

function importName(node: SyntaxNode): string | null {
  if (node.type === "dotted_name" || node.type === "identifier") return node.text.trim();
  if (node.type === "aliased_import") return node.childForFieldName("name")?.text.trim() ?? node.namedChildren[0]?.text.trim() ?? null;
  return null;
}
