/** Go tree-sitter WASM analyzer. */
import * as path from "path";
import type { Analyzer, ExportRef, ImportRef, SourceFile } from "../spi.js";
import { parseWithTreeSitter, stringLiteralValue, type SyntaxNode, visit } from "../treeSitterRuntime.js";

const GO_EXTENSIONS = [".go"];

/**
 * Tree-sitter WASM analyzer for Go source files (.go).
 * Extracts import specifiers and exported identifiers (functions, types, variables, constants).
 */
export const goTreeSitterAnalyzer: Analyzer = {
  language: "go",
  extensions: GO_EXTENSIONS,
  detect(filePath: string): boolean {
    return GO_EXTENSIONS.includes(path.extname(filePath));
  },
  parseImports(file: SourceFile): Promise<ImportRef[]> {
    return parseWithTreeSitter("go", file.content, [], collectGoImports);
  },
  parseExports(file: SourceFile): Promise<ExportRef[]> {
    return parseWithTreeSitter("go", file.content, [], collectGoExports);
  },
};

function collectGoImports(root: SyntaxNode): ImportRef[] {
  const imports: ImportRef[] = [];
  visit(root, (node) => {
    if (node.type !== "import_spec") return;
    const stringNode = node.namedChildren.find((child) => child.type.endsWith("string_literal"));
    const specifier = stringLiteralValue(stringNode);
    if (specifier) imports.push({ specifier, kind: "static" });
  });
  return imports;
}

function collectGoExports(root: SyntaxNode): ExportRef[] {
  const exports: ExportRef[] = [];
  visit(root, (node) => {
    for (const name of exportedGoNames(node)) {
      exports.push({ name, kind: "named" });
    }
  });
  return exports;
}

function exportedGoNames(node: SyntaxNode): string[] {
  if (node.type === "function_declaration") return exportedIdentifier(node.namedChildren.find((child) => child.type === "identifier")?.text);
  if (node.type === "type_spec") return exportedIdentifier(node.namedChildren.find((child) => child.type === "type_identifier")?.text);
  if (node.type === "var_spec" || node.type === "const_spec") {
    return node.namedChildren.filter((child) => child.type === "identifier").flatMap((child) => exportedIdentifier(child.text));
  }
  return [];
}

function exportedIdentifier(name: string | undefined): string[] {
  return name && /^[A-Z]/.test(name) ? [name] : [];
}
