/** Helpers for lightweight source-code text analysis without a full AST parser. */

/** Strip comments, strings, template literals, and regex literals while preserving line breaks. */
export function stripNonCode(source: string): string {
  let output = "";
  let i = 0;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", i + 2);
      if (end === -1) break;
      output += "\n";
      i = end + 1;
      continue;
    }

    if (char === "/" && next === "*") {
      i = maskUntilBlockCommentEnd(source, i + 2, (masked) => { output += masked; });
      continue;
    }

    if (char === '"' || char === "'") {
      i = maskQuoted(source, i, char, (masked) => { output += masked; });
      continue;
    }

    if (char === "`") {
      i = maskQuoted(source, i, "`", (masked) => { output += masked; });
      continue;
    }

    if (char === "/" && looksLikeRegexStart(output)) {
      i = maskRegexLiteral(source, i, (masked) => { output += masked; });
      continue;
    }

    output += char;
    i++;
  }

  return output;
}

function maskUntilBlockCommentEnd(source: string, start: number, append: (masked: string) => void): number {
  append("  ");
  let i = start;
  while (i < source.length) {
    if (source[i] === "*" && source[i + 1] === "/") {
      append("  ");
      return i + 2;
    }
    append(source[i] === "\n" ? "\n" : " ");
    i++;
  }
  return source.length;
}

function maskQuoted(source: string, start: number, quote: string, append: (masked: string) => void): number {
  append(" ");
  let i = start + 1;
  while (i < source.length) {
    const char = source[i];
    append(char === "\n" ? "\n" : " ");
    if (char === "\\") {
      i += 2;
      append(" ");
      continue;
    }
    if (char === quote) return i + 1;
    i++;
  }
  return source.length;
}

function maskRegexLiteral(source: string, start: number, append: (masked: string) => void): number {
  append(" ");
  let i = start + 1;
  let inClass = false;

  while (i < source.length) {
    const char = source[i];
    append(char === "\n" ? "\n" : " ");

    if (char === "\\") {
      i += 2;
      append(" ");
      continue;
    }
    if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    else if (char === "/" && !inClass) {
      i++;
      while (/[a-z]/i.test(source[i] || "")) {
        append(" ");
        i++;
      }
      return i;
    }
    if (char === "\n") return i + 1;
    i++;
  }

  return source.length;
}

function looksLikeRegexStart(output: string): boolean {
  const trimmed = output.replace(/\s+$/g, "");
  if (!trimmed) return true;

  const prev = trimmed[trimmed.length - 1];
  if ("({[=,:;!&|?+-*~^<>".includes(prev)) return true;

  const tail = trimmed.slice(-20);
  return /\b(return|throw|case|delete|void|typeof|yield)$/.test(tail);
}
