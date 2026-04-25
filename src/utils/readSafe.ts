/** Safe file reader utility — tr? v? null n?u không d?c du?c. */
import * as fs from "fs";
import * as path from "path";

/** Read a file safely with size and path guards. */
export function readSafe(repo: string, file: string): string | null {
  try { return fs.readFileSync(path.join(repo, file), "utf-8"); } catch { return null; }
}
