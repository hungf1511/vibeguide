/** Shared lazy tree-sitter WASM runtime. */
import { createRequire } from "module";
import * as Parser from "web-tree-sitter";

export type SyntaxNode = Parser.Node;

export type TreeSitterGrammar = "javascript" | "typescript" | "tsx" | "python" | "go" | "rust";

const require = createRequire(import.meta.url);
const treeSitterWasmPath = require.resolve("web-tree-sitter/web-tree-sitter.wasm");
const grammarFiles: Record<TreeSitterGrammar, string> = {
  javascript: "tree-sitter-javascript.wasm",
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  python: "tree-sitter-python.wasm",
  go: "tree-sitter-go.wasm",
  rust: "tree-sitter-rust.wasm",
};

let initPromise: Promise<void> | null = null;
const languagePromises = new Map<TreeSitterGrammar, Promise<Parser.Language>>();

/**
 * Returns the list of tree-sitter grammars that have already been loaded into memory.
 * Useful for diagnostics and verifying lazy-loading behavior.
 */
export function getLoadedTreeSitterGrammars(): TreeSitterGrammar[] {
  return Array.from(languagePromises.keys());
}

async function ensureRuntime(): Promise<void> {
  initPromise ??= Parser.Parser.init({ locateFile: () => treeSitterWasmPath });
  return initPromise;
}

async function loadLanguage(grammar: TreeSitterGrammar): Promise<Parser.Language> {
  try {
    await ensureRuntime();
    let languagePromise = languagePromises.get(grammar);
    if (!languagePromise) {
      const grammarPath = require.resolve(`@vscode/tree-sitter-wasm/wasm/${grammarFiles[grammar]}`);
      languagePromise = Parser.Language.load(grammarPath);
      languagePromises.set(grammar, languagePromise);
    }
    return languagePromise;
  } catch (error) {
    languagePromises.delete(grammar);
    throw error;
  }
}

/**
 * Parses source content with the specified tree-sitter grammar and collects results.
 * Lazily initializes the WASM runtime and grammar on first use.
 * @param grammar - The tree-sitter grammar to use for parsing.
 * @param content - The source code content to parse.
 * @param fallback - Value to return if parsing fails or the runtime is unavailable.
 * @param collect - Callback that extracts desired data from the parsed AST root node.
 * @returns The collected data, or the fallback value on error.
 */
export async function parseWithTreeSitter<T>(
  grammar: TreeSitterGrammar,
  content: string,
  fallback: T,
  collect: (root: SyntaxNode) => T,
): Promise<T> {
  try {
    const language = await loadLanguage(grammar);
    const parser = new Parser.Parser();
    parser.setLanguage(language);
    const tree = parser.parse(content);
    try {
      return tree ? collect(tree.rootNode) : fallback;
    } finally {
      tree?.delete();
      parser.delete();
    }
  } catch {
    return fallback;
  }
}

/**
 * Recursively visits every named node in the AST, invoking the callback for each.
 * @param node - The AST node to traverse.
 * @param callback - Function called for each visited node (including the starting node).
 */
export function visit(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (const child of node.namedChildren) visit(child, callback);
}

/**
 * Extracts the raw string value from a string literal AST node.
 * Handles quoted strings, template strings, and string_fragment nodes.
 * @param node - The AST node representing a string literal.
 * @returns The unquoted string content, or null if the node is not a recognized string literal.
 */
export function stringLiteralValue(node: SyntaxNode | null | undefined): string | null {
  if (!node) return null;
  const fragment = node.namedChildren.find((child) => child.type.endsWith("string_literal_content") || child.type === "string_fragment");
  if (fragment) return fragment.text;

  const text = node.text.trim();
  if (text.length >= 2 && /^(["'`]).*\1$/s.test(text)) return text.slice(1, -1);
  return null;
}

/**
 * Finds the first named child of a node whose type matches one of the given types.
 * @param node - The parent AST node.
 * @param types - Array of child node types to search for.
 * @returns The first matching child node, or null if none match.
 */
export function firstNamedChildOfType(node: SyntaxNode, types: string[]): SyntaxNode | null {
  return node.namedChildren.find((child) => types.includes(child.type)) ?? null;
}
