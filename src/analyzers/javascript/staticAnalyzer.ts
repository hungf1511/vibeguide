/** JavaScript/TypeScript import analyzer with static regex parity. */
import * as path from "path";
import type { Analyzer, ExportRef, ImportKind, ImportRef, SourceFile } from "../spi.js";

const JAVASCRIPT_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs"];
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".vue"];
const JS_LIKE_EXTENSIONS = [...TYPESCRIPT_EXTENSIONS, ...JAVASCRIPT_EXTENSIONS];

const importRegex = /(?:import\s+(?:.*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)|from\s+["']([^"']+)["']|export\s+(?:\*\s+from\s+|{[^}]*}\s+from\s+)["']([^"']+)["'])/g;

const exportRegex = /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)|export\s*{\s*([^}]+)\s*}/g;

function detectKind(match: RegExpExecArray): ImportKind {
  if (match[2]) return "dynamic";
  if (match[3]) return "require";
  if (match[5]) return "re-export";
  return "static";
}

function createJavaScriptLikeAnalyzer(language: "javascript" | "typescript", extensions: string[]): Analyzer {
  return {
    language,
    extensions,
    detect(filePath: string): boolean {
      return extensions.includes(path.extname(filePath));
    },
    parseImports(file: SourceFile): ImportRef[] {
      const imports: ImportRef[] = [];
      let match: RegExpExecArray | null;
      importRegex.lastIndex = 0;

      while ((match = importRegex.exec(file.content)) !== null) {
        const specifier = match[1] || match[2] || match[3] || match[4] || match[5];
        if (!specifier) continue;
        imports.push({ specifier, kind: detectKind(match) });
      }

      return imports;
    },
    parseExports(file: SourceFile): ExportRef[] {
      const exports: ExportRef[] = [];
      let match: RegExpExecArray | null;
      exportRegex.lastIndex = 0;

      while ((match = exportRegex.exec(file.content)) !== null) {
        if (match[1]) {
          exports.push({ name: match[1], kind: "named" });
          continue;
        }

        if (!match[2]) continue;
        for (const part of match[2].split(",")) {
          const name = part.trim().split(/\s+as\s+/i).pop()?.trim();
          if (name) exports.push({ name, kind: "named" });
        }
      }

      return exports;
    },
  };
}

/** Analyzer for JavaScript runtime files. */
export const javascriptAnalyzer = createJavaScriptLikeAnalyzer("javascript", JAVASCRIPT_EXTENSIONS);
/** Analyzer for TypeScript and TSX/Vue files. */
export const typescriptAnalyzer = createJavaScriptLikeAnalyzer("typescript", TYPESCRIPT_EXTENSIONS);
/** Backward-compatible analyzer used by legacy parser mode. */
export const legacyJavaScriptAnalyzer = createJavaScriptLikeAnalyzer("typescript", JS_LIKE_EXTENSIONS);
