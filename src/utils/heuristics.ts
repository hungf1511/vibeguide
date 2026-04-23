export interface BugPattern {
  id: string;
  regex: RegExp;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export const BUG_PATTERNS: BugPattern[] = [
  {
    id: "unhandled-promise",
    regex: /\.then\s*\([^)]*\)\s*[^.]*\n(?!.*catch)/,
    description: "Promise without catch",
    severity: "high",
  },
  {
    id: "unawaited-fetch",
    regex: /^\s*(?:const|let|var)\s+\w+\s*=\s*(?!await\b)\s*(fetch|axios\.\w+)\s*\(/,
    description: "Promise returned by fetch/axios assigned without await",
    severity: "high",
  },
  {
    id: "missing-try-catch",
    regex: /await\s+\w+\([^)]*\)(?!\s*catch)(?!\s*\?)/,
    description: "Async call without try/catch",
    severity: "medium",
  },
  {
    id: "hardcoded-secret",
    regex: /(?:password|secret|token|api_key)\s*[:=]\s*["'][^"']{8,}["']/i,
    description: "Potential hardcoded secret",
    severity: "critical",
  },
  {
    id: "console-log",
    regex: /console\.(log|warn|error)\s*\(/,
    description: "Leftover console.log",
    severity: "low",
  },
  {
    id: "any-type",
    regex: /:\s*any\b/,
    description: "TypeScript any usage",
    severity: "low",
  },
  {
    id: "todo-fixme",
    regex: /\/\/\s*(TODO|FIXME|HACK|XXX)/i,
    description: "Unresolved TODO/FIXME",
    severity: "medium",
  },
  {
    id: "sql-injection",
    regex: /(?:query|exec)\s*\(\s*[`"'].*\$\{/,
    description: "Possible SQL injection via template literal",
    severity: "critical",
  },
  {
    id: "eval-usage",
    regex: /\beval\s*\(/,
    description: "Dangerous eval() usage",
    severity: "critical",
  },
];

export function matchPatterns(content: string, filePath: string): { pattern: BugPattern; line: number }[] {
  const matches: { pattern: BugPattern; line: number }[] = [];
  const lines = content.split("\n");

  for (const pattern of BUG_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const stripped = stripNoise(lines[i]);
      if (pattern.regex.test(stripped)) {
        // Context check: skip false-positive missing-try-catch when await
        // is already inside a try/catch block spanning multiple lines.
        if (pattern.id === "missing-try-catch") {
          const before = lines.slice(Math.max(0, i - 4), i).join("\n");
          const after = lines.slice(i + 1, Math.min(lines.length, i + 6)).join("\n");
          const hasTry = /\btry\s*\{/.test(before);
          const hasCatch = /\bcatch\s*\(/.test(after) || /\bcatch\s*\{/.test(after);
          if (hasTry && hasCatch) continue;
        }
        matches.push({ pattern, line: i + 1 });
      }
    }
  }

  return matches;
}

/** Remove string literals and regex definitions from a line
 *  so pattern matching doesn't flag text/regex definitions as code usage. */
function stripNoise(line: string): string {
  let result = line;
  // Remove string content: "..." and '...'
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  // Remove template literal content: `...`
  result = result.replace(/`(?:[^`\\]|\\.)*`/g, "``");
  // Remove regex definitions: /pattern/flags (after = or : or ,)
  result = result.replace(new RegExp("(?:[:=,]\\s*)\\/(?:[^\\/\\\\]|\\\\\\/)*\\/[gimsuy]*", "g"), " /REGEX/");
  return result;
}
