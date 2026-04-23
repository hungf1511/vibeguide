import type { FixSuggestion } from "../types.js";

export function generateSuggestion(content: string, patternId: string, line: number): FixSuggestion | null {
  const lines = content.split("\n");
  if (line < 1 || line > lines.length) return null;
  const original = lines[line - 1];

  switch (patternId) {
    case "unawaited-fetch": {
      const fixed = original.replace(/^(\s*)(?:const|let|var)\s+(\w+)\s*=\s*(?!await\b)\s*(fetch|axios\.\w+)/, "$1const $2 = await $3");
      if (fixed === original) return null;
      return {
        line,
        original: original.trim(),
        fixed: fixed.trim(),
        explanation: "Thêm `await` để đợi Promise hoàn thành, tránh unhandled promise.",
      };
    }

    case "missing-try-catch": {
      const indent = original.match(/^(\s*)/)?.[1] || "";
      const fixed = `${indent}try {\n${indent}  ${original.trim()}\n${indent}} catch (err) {\n${indent}  console.error(err);\n${indent}}`;
      return {
        line,
        original: original.trim(),
        fixed,
        explanation: "Bọc async call trong try/catch để tránh crash khi request thất bại.",
      };
    }

    case "console-log": {
      const fixed = original.replace(/console\.(log|warn|error)\s*\([^)]*\)\s*;?\s*$/, "").trim();
      if (fixed === original.trim()) return null;
      return {
        line,
        original: original.trim(),
        fixed: fixed || "// Removed console.log",
        explanation: "Xóa console.log trước khi deploy — dùng logger chuyên dụng thay thế.",
      };
    }

    case "hardcoded-secret": {
      const match = original.match(/((?:password|secret|token|api_key)\s*[:=]\s*["'])[^"']+(["'])/i);
      if (!match) return null;
      const fixed = original.replace(/["'][^"']{8,}["']/i, "process.env.SECRET_KEY");
      return {
        line,
        original: original.trim(),
        fixed: fixed.trim(),
        explanation: "Dùng biến môi trường `process.env.SECRET_KEY` thay vì hardcode secret.",
      };
    }

    case "any-type": {
      const fixed = original.replace(/:\s*any\b/g, ": unknown");
      if (fixed === original) return null;
      return {
        line,
        original: original.trim(),
        fixed: fixed.trim(),
        explanation: "Tránh dùng `any` — thay bằng `unknown` hoặc type cụ thể.",
      };
    }

    case "todo-fixme": {
      return {
        line,
        original: original.trim(),
        fixed: original.replace(/\/\/\s*(TODO|FIXME|HACK|XXX)\s*:?\s*/i, "// Resolved: ").trim(),
        explanation: "TODO/FIXME còn tồn đọng — nên xử lý hoặc xóa trước khi deploy.",
      };
    }

    case "sql-injection": {
      return {
        line,
        original: original.trim(),
        fixed: "// Use parameterized query instead of template literal\n" + original.trim(),
        explanation: "Dùng prepared statement thay vì nối string để tránh SQL injection.",
      };
    }

    case "eval-usage": {
      const fixed = original.replace(/\beval\s*\(([^)]+)\)/g, "JSON.parse($1)");
      if (fixed === original) return null;
      return {
        line,
        original: original.trim(),
        fixed: fixed.trim(),
        explanation: "`eval()` nguy hiểm — thay bằng `JSON.parse()` hoặc parser an toàn.",
      };
    }

    default:
      return null;
  }
}
