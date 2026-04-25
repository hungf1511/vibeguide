/** JavaScript/TypeScript tree-sitter WASM analyzers. */
import * as path from "path";
import type { Analyzer, ExportRef, ImportKind, ImportRef, SourceFile } from "../spi.js";
import { firstNamedChildOfType, parseWithTreeSitter, stringLiteralValue, type SyntaxNode, type TreeSitterGrammar, visit } from "../treeSitterRuntime.js";
import { javascriptAnalyzer, typescriptAnalyzer } from "./staticAnalyzer.js";

const JAVASCRIPT_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs"];
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".vue"];

/**
 * Tree-sitter WASM analyzer for JavaScript files (.js, .jsx, .mjs, .cjs).
 * Parses import and export statements using the tree-sitter JavaScript grammar.
 */
export const javascriptTreeSitterAnalyzer: Analyzer = {
  language: "javascript",
  extensions: JAVASCRIPT_EXTENSIONS,
  detect(filePath: string): boolean {
    return JAVASCRIPT_EXTENSIONS.includes(path.extname(filePath));
  },
  parseImports(file: SourceFile): Promise<ImportRef[]> {
    return parseWithTreeSitter("javascript", file.content, [], collectJavaScriptImports);
  },
  parseExports(file: SourceFile): Promise<ExportRef[]> {
    return parseWithTreeSitter("javascript", file.content, [], collectJavaScriptExports);
  },
};

/**
 * Tree-sitter WASM analyzer for TypeScript files (.ts, .tsx, .vue).
 * Automatically selects the TypeScript or TSX grammar based on file extension.
 * Falls back to the static TypeScript analyzer for unsupported extensions.
 */
export const typescriptTreeSitterAnalyzer: Analyzer = {
  language: "typescript",
  extensions: TYPESCRIPT_EXTENSIONS,
  detect(filePath: string): boolean {
    return TYPESCRIPT_EXTENSIONS.includes(path.extname(filePath));
  },
  parseImports(file: SourceFile): Promise<ImportRef[]> | ImportRef[] {
    const grammar = grammarForTypeScriptFile(file.path);
    return grammar ? parseWithTreeSitter(grammar, file.content, [], collectJavaScriptImports) : typescriptAnalyzer.parseImports(file);
  },
  parseExports(file: SourceFile): Promise<ExportRef[]> | ExportRef[] {
    const grammar = grammarForTypeScriptFile(file.path);
    return grammar ? parseWithTreeSitter(grammar, file.content, [], collectJavaScriptExports) : typescriptAnalyzer.parseExports(file);
  },
};

function grammarForTypeScriptFile(filePath: string): TreeSitterGrammar | null {
  const ext = path.extname(filePath);
  if (ext === ".tsx") return "tsx";
  if (ext === ".ts") return "typescript";
  return null;
}

function collectJavaScriptImports(root: SyntaxNode): ImportRef[] {
  const imports: ImportRef[] = [];
  visit(root, (node) => {
    if (node.type === "import_statement") {
      const specifier = directStringSpecifier(node);
      if (specifier) imports.push({ specifier, kind: importStatementKind(node) });
      return;
    }
    if (node.type === "export_statement") {
      const specifier = directStringSpecifier(node);
      if (specifier) imports.push({ specifier, kind: "re-export" });
      return;
    }
    if (node.type === "call_expression") {
      const callKind = callImportKind(node);
      const specifier = callKind ? directStringSpecifier(node) : null;
      if (specifier && callKind) imports.push({ specifier, kind: callKind });
    }
  });
  return imports;
}

function collectJavaScriptExports(root: SyntaxNode): ExportRef[] {
  const exports: ExportRef[] = [];
  visit(root, (node) => {
    if (node.type !== "export_statement") return;
    const declaration = firstNamedChildOfType(node, [
      "function_declaration",
      "class_declaration",
      "interface_declaration",
      "type_alias_declaration",
      "enum_declaration",
      "lexical_declaration",
    ]);
    if (declaration) {
      exports.push(...declarationExportNames(declaration).map((name) => ({ name, kind: "named" as const })));
      return;
    }

    const exportClause = firstNamedChildOfType(node, ["export_clause"]);
    if (!exportClause) return;
    for (const specifier of exportClause.namedChildren.filter((child) => child.type === "export_specifier")) {
      const name = specifier.namedChildren.at(-1)?.text.trim();
      if (name) exports.push({ name, kind: "named" });
    }
  });
  return exports;
}

function importStatementKind(node: SyntaxNode): ImportKind {
  return node.namedChildren.some((child) => child.type === "import_require_clause") ? "require" : "static";
}

function callImportKind(node: SyntaxNode): ImportKind | null {
  const callee = node.namedChildren[0];
  if (callee?.type === "import") return "dynamic";
  if (callee?.type === "identifier" && callee.text === "require") return "require";
  return null;
}

function directStringSpecifier(node: SyntaxNode): string | null {
  let value: string | null = null;
  visit(node, (child) => {
    if (value) return;
    if (child.type === "string" || child.type === "template_string") value = stringLiteralValue(child);
  });
  return value;
}

function declarationExportNames(node: SyntaxNode): string[] {
  if (node.type === "lexical_declaration") {
    const names: string[] = [];
    visit(node, (child) => {
      if (child.type === "variable_declarator") {
        const name = child.childForFieldName("name")?.text.trim() ?? child.namedChildren[0]?.text.trim();
        if (name) names.push(name);
      }
    });
    return names;
  }

  const name = node.childForFieldName("name")?.text.trim() ?? node.namedChildren.find((child) => /identifier$/.test(child.type))?.text.trim();
  return name ? [name] : [];
}
