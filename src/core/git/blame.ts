/** Git blame — line-level ownership info. */
import { runGit, isGitRepo } from "./runGit.js";

export interface BlameEntry {
  sha: string;
  author: string;
  date: string;
  line: number;
  content: string;
}

/** Get blame info for a file (porcelain format) */
export function getBlame(dir: string, filePath: string): BlameEntry[] {
  if (!isGitRepo(dir)) return [];
  try {
    const output = runGit(dir, ["blame", "--porcelain", filePath]);
    return parsePorcelain(output);
  } catch {
    return [];
  }
}

function parsePorcelain(output: string): BlameEntry[] {
  const lines = output.split("\n");
  const result: BlameEntry[] = [];
  let lineNum = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }

    // Header lines start with SHA
    const shaMatch = line.match(/^([a-f0-9]+)\s+(\d+)\s+(\d+)\s+(\d+)/);
    if (shaMatch) {
      lineNum = parseInt(shaMatch[3], 10);
      const sha = shaMatch[1];
      let author = "";
      let date = "";
      i++;

      // Read metadata lines (indented, not SHA-prefixed)
      while (i < lines.length && lines[i] && !lines[i].match(/^\t/) && !isHeaderLine(lines[i])) {
        const metaLine = lines[i];
        if (metaLine.startsWith("author ")) author = metaLine.slice(7);
        if (metaLine.startsWith("author-time ")) date = new Date(parseInt(metaLine.slice(12), 10) * 1000).toISOString();
        i++;
      }

      // Content line (starts with tab)
      const content = lines[i]?.startsWith("\t") ? lines[i].slice(1) : lines[i] || "";
      i++;

      result.push({ sha: sha.slice(0, 7), author, date, line: lineNum, content });
    } else {
      i++;
    }
  }
  return result;
}

function isHeaderLine(line: string): boolean {
  return /^([a-f0-9]+)\s+(\d+)\s+(\d+)\s+(\d+)/.test(line);
}
