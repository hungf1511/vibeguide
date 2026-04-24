/** Safe file reader utility — trả về null nếu không đọc được. */
import * as fs from "fs";
import * as path from "path";

export function readSafe(repo: string, file: string): string | null {
  try { return fs.readFileSync(path.join(repo, file), "utf-8"); } catch { return null; }
}
