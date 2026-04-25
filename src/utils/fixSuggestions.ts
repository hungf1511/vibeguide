/** Tao concrete fix suggestion dua tren bug pattern va dong code. */
import type { FixSuggestion } from "../types.js";

type SuggestionBuilder = (original: string, line: number) => FixSuggestion | null;

const SUGGESTION_BUILDERS: Record<string, SuggestionBuilder> = {
  "unawaited-fetch": buildUnawaitedFetchSuggestion,
  "missing-try-catch": buildMissingTryCatchSuggestion,
  "console-log": buildConsoleLogSuggestion,
  "hardcoded-secret": buildHardcodedSecretSuggestion,
  "any-type": buildAnyTypeSuggestion,
  "todo-fixme": buildTodoSuggestion,
  "sql-injection": buildSqlInjectionSuggestion,
  "eval-usage": buildEvalUsageSuggestion,
};

/** Generate a fix suggestion for a matched pattern. */
export function generateSuggestion(content: string, patternId: string, line: number): FixSuggestion | null {
  const lines = content.split("\n");
  if (line < 1 || line > lines.length) return null;

  const builder = SUGGESTION_BUILDERS[patternId];
  return builder ? builder(lines[line - 1], line) : null;
}

function makeSuggestion(line: number, original: string, fixed: string, explanation: string): FixSuggestion {
  return { line, original: original.trim(), fixed, explanation };
}

function buildUnawaitedFetchSuggestion(original: string, line: number): FixSuggestion | null {
  const fixed = original.replace(/^(\s*)(?:const|let|var)\s+(\w+)\s*=\s*(?!await\b)\s*(fetch|axios\.\w+)/, "$1const $2 = await $3");
  if (fixed === original) return null;

  return makeSuggestion(line, original, fixed.trim(), "Them `await` de doi Promise hoan thanh, tranh unhandled promise.");
}

function buildMissingTryCatchSuggestion(original: string, line: number): FixSuggestion {
  const indent = original.match(/^(\s*)/)?.[1] || "";
  const fixed = `${indent}try {\n${indent}  ${original.trim()}\n${indent}} catch (err) {\n${indent}  console.error(err);\n${indent}}`;
  return makeSuggestion(line, original, fixed, "Boc async call trong try/catch de tranh crash khi request that bai.");
}

function buildConsoleLogSuggestion(original: string, line: number): FixSuggestion | null {
  const fixed = original.replace(/console\.(log|warn|error)\s*\([^)]*\)\s*;?\s*$/, "").trim();
  if (fixed === original.trim()) return null;

  return makeSuggestion(line, original, fixed || "// Removed console.log", "Xoa console.log truoc khi deploy - dung logger chuyen dung thay the.");
}

function buildHardcodedSecretSuggestion(original: string, line: number): FixSuggestion | null {
  const match = original.match(/((?:password|secret|token|api_key)\s*[:=]\s*["'])[^"']+(["'])/i);
  if (!match) return null;

  const fixed = original.replace(/["'][^"']{8,}["']/i, "process.env.SECRET_KEY");
  return makeSuggestion(line, original, fixed.trim(), "Dung bien moi truong `process.env.SECRET_KEY` thay vi hardcode secret.");
}

function buildAnyTypeSuggestion(original: string, line: number): FixSuggestion | null {
  const fixed = original.replace(/:\s*any\b/g, ": unknown");
  if (fixed === original) return null;

  return makeSuggestion(line, original, fixed.trim(), "Tranh dung `any` - thay bang `unknown` hoac type cu the.");
}

function buildTodoSuggestion(original: string, line: number): FixSuggestion {
  const fixed = original.replace(/\/\/\s*(TODO|FIXME|HACK|XXX)\s*:?\s*/i, "// Resolved: ").trim();
  return makeSuggestion(line, original, fixed, "TODO/FIXME con ton dong - nen xu ly hoac xoa truoc khi deploy.");
}

function buildSqlInjectionSuggestion(original: string, line: number): FixSuggestion {
  const fixed = "// Use parameterized query instead of template literal\n" + original.trim();
  return makeSuggestion(line, original, fixed, "Dung prepared statement thay vi noi string de tranh SQL injection.");
}

function buildEvalUsageSuggestion(original: string, line: number): FixSuggestion | null {
  const fixed = original.replace(/\beval\s*\(([^)]+)\)/g, "JSON.parse($1)");
  if (fixed === original) return null;

  return makeSuggestion(line, original, fixed.trim(), "`eval()` nguy hiem - thay bang `JSON.parse()` hoac parser an toan.");
}
