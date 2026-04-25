/** T�m file thi?u README v� export thi?u JSDoc. */
import * as fs from "fs";
import * as path from "path";
import type { DocGapResult } from "../types.js";
import { getAllSourceFiles } from "./scanner.js";

/** Find files missing README and exports missing JSDoc. */
export function findDocGaps(repo: string): DocGapResult {
  const allFiles = getAllSourceFiles(repo);
  const folders = new Set<string>();
  for (const f of allFiles) {
    const dir = path.dirname(f);
    if (dir && dir !== ".") folders.add(dir);
  }
  const foldersMissingReadme: string[] = [];
  for (const folder of folders) {
    const readmeCandidates = ["README.md", "README", "readme.md"];
    const has = readmeCandidates.some((name) => fs.existsSync(path.join(repo, folder, name)));
    if (!has && !folder.includes("test") && !folder.startsWith("dist")) foldersMissingReadme.push(folder);
  }

  const filesMissingDoc: string[] = [];
  const exportsMissingJsdoc: { file: string; symbol: string }[] = [];
  const exportRegex = /export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g;
  for (const file of allFiles) {
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file)) continue;
    let content: string;
    try {
      content = fs.readFileSync(path.join(repo, file), "utf-8");
    } catch {
      continue; // file vanished mid-scan
    }
    let hasAnyExport = false;
    let m: RegExpExecArray | null;
    while ((m = exportRegex.exec(content)) !== null) {
      hasAnyExport = true;
      const idx = m.index;
      const before = content.slice(Math.max(0, idx - 200), idx);
      if (!/\*\/\s*$/.test(before)) {
        exportsMissingJsdoc.push({ file, symbol: m[1] });
      }
    }
    if (hasAnyExport) {
      const top = content.slice(0, 300);
      if (!/^\s*\/\*\*/.test(top) && !/\/\/\s*\S/.test(top)) filesMissingDoc.push(file);
    }
    exportRegex.lastIndex = 0;
  }

  const summary = foldersMissingReadme.length + " folder thieu README, " + exportsMissingJsdoc.length + " export thieu JSDoc, " + filesMissingDoc.length + " file thieu file-level doc.";
  return {
    filesMissingDoc: filesMissingDoc.slice(0, 20),
    foldersMissingReadme: foldersMissingReadme.slice(0, 20),
    exportsMissingJsdoc: exportsMissingJsdoc.slice(0, 30),
    summary,
  };
}
