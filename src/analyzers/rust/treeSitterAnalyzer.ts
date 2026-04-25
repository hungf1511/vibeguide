/** Rust tree-sitter WASM analyzer. */
import * as path from "path";
import type { Analyzer, ExportRef, ImportRef, SourceFile } from "../spi.js";
import { parseWithTreeSitter, type SyntaxNode, visit } from "../treeSitterRuntime.js";

const RUST_EXTENSIONS = [".rs"];

/**
 * Tree-sitter WASM analyzer for Rust source files (.rs).
 * Extracts local module references, crate-relative use paths, and public item exports.
 */
export const rustTreeSitterAnalyzer: Analyzer = {
  language: "rust",
  extensions: RUST_EXTENSIONS,
  detect(filePath: string): boolean {
    return RUST_EXTENSIONS.includes(path.extname(filePath));
  },
  parseImports(file: SourceFile): Promise<ImportRef[]> {
    return parseWithTreeSitter("rust", file.content, [], collectRustImports);
  },
  parseExports(file: SourceFile): Promise<ExportRef[]> {
    return parseWithTreeSitter("rust", file.content, [], collectRustExports);
  },
};

function collectRustImports(root: SyntaxNode): ImportRef[] {
  const imports: ImportRef[] = [];
  visit(root, (node) => {
    if (node.type === "mod_item" && node.text.trim().endsWith(";")) {
      const name = firstIdentifier(node);
      if (name) imports.push({ specifier: `./${name}`, kind: "static" });
      return;
    }
    if (node.type !== "use_declaration") return;
    const rawPath = node.text.replace(/^\s*(?:pub\s+)?use\s+/, "").replace(/;\s*$/, "");
    for (const specifier of expandUsePath(rawPath)) {
      imports.push({ specifier, kind: "static" });
    }
  });
  return imports;
}

function collectRustExports(root: SyntaxNode): ExportRef[] {
  const exports: ExportRef[] = [];
  visit(root, (node) => {
    if (!isPublicItem(node)) return;
    const name = firstIdentifier(node);
    if (name) exports.push({ name, kind: "named" });
  });
  return exports;
}

function isPublicItem(node: SyntaxNode): boolean {
  return ["function_item", "struct_item", "enum_item", "trait_item", "type_item", "const_item", "static_item", "mod_item"].includes(node.type)
    && node.namedChildren.some((child) => child.type === "visibility_modifier");
}

function firstIdentifier(node: SyntaxNode): string | null {
  return node.namedChildren.find((child) => child.type === "identifier" || child.type === "type_identifier")?.text.trim() ?? null;
}

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
