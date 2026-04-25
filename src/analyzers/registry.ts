/** Analyzer registry: language dispatch and language-support reporting. */
import * as fs from "fs";
import * as path from "path";
import { goAnalyzer, goTreeSitterAnalyzer } from "./go/index.js";
import { javascriptAnalyzer, legacyJavaScriptAnalyzer, typescriptAnalyzer } from "./javascript/staticAnalyzer.js";
import { javascriptTreeSitterAnalyzer, typescriptTreeSitterAnalyzer } from "./javascript/treeSitterAnalyzer.js";
import { pythonAnalyzer, pythonTreeSitterAnalyzer } from "./python/index.js";
import { rustAnalyzer, rustTreeSitterAnalyzer } from "./rust/index.js";
import type { Analyzer, Language, SourceFile } from "./spi.js";

const STATIC_ANALYZERS: Analyzer[] = [
  typescriptAnalyzer,
  javascriptAnalyzer,
  pythonAnalyzer,
  goAnalyzer,
  rustAnalyzer,
];

const TREE_SITTER_ANALYZERS: Analyzer[] = [
  typescriptTreeSitterAnalyzer,
  javascriptTreeSitterAnalyzer,
  pythonTreeSitterAnalyzer,
  goTreeSitterAnalyzer,
  rustTreeSitterAnalyzer,
];

export interface AnalyzerSupport {
  language: Language;
  extensions: string[];
  active: boolean;
  strategy: "static-parser" | "legacy-regex" | "tree-sitter-wasm";
  backend: "static" | "tree-sitter";
}

export interface AnalyzerRegistryOptions {
  backend?: "static" | "tree-sitter";
  legacyParser?: boolean;
}

const DEFAULT_BACKEND: NonNullable<AnalyzerRegistryOptions["backend"]> = "tree-sitter";

/** Return all built-in analyzers in dispatch order. */
export function getAnalyzers(options: AnalyzerRegistryOptions = {}): Analyzer[] {
  if (options.legacyParser) return [legacyJavaScriptAnalyzer];
  const backend = options.backend ?? DEFAULT_BACKEND;
  return backend === "tree-sitter" ? TREE_SITTER_ANALYZERS : STATIC_ANALYZERS;
}

/** Select the analyzer responsible for a file path. */
export function getAnalyzerForFile(filePath: string, content?: string, options: AnalyzerRegistryOptions = {}): Analyzer | null {
  return getAnalyzers(options).find((analyzer) => analyzer.detect(filePath, content)) ?? null;
}

/** Build the normalized SourceFile object passed to analyzers. */
export function createSourceFile(baseDir: string, filePath: string, content: string): SourceFile {
  return {
    path: filePath,
    absolutePath: path.join(baseDir, filePath),
    content,
    extension: path.extname(filePath),
  };
}

/** Report which analyzer languages are active for a repository. */
export function getLanguageSupport(repoPath?: string, options: AnalyzerRegistryOptions = {}): AnalyzerSupport[] {
  const existingExtensions = repoPath ? collectExtensions(repoPath) : new Set<string>();
  const backend = options.backend ?? DEFAULT_BACKEND;
  return getAnalyzers(options).map((analyzer) => ({
    language: analyzer.language,
    extensions: analyzer.extensions,
    active: !repoPath || analyzer.extensions.some((ext) => existingExtensions.has(ext)),
    strategy: analyzerStrategy(analyzer.language, { ...options, backend }),
    backend,
  }));
}

function analyzerStrategy(language: Language, options: AnalyzerRegistryOptions): AnalyzerSupport["strategy"] {
  if (options.legacyParser) return "legacy-regex";
  return options.backend === "tree-sitter" && ["javascript", "typescript", "python", "go", "rust"].includes(language)
    ? "tree-sitter-wasm"
    : "static-parser";
}

function collectExtensions(repoPath: string): Set<string> {
  const extensions = new Set<string>();
  walk(repoPath, extensions);
  return extensions;
}

function walk(current: string, extensions: Set<string>): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || ["node_modules", "dist", "build", "coverage", "cache"].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, extensions);
    } else {
      extensions.add(path.extname(entry.name));
    }
  }
}
