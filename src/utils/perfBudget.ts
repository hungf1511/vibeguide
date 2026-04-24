/** Kiểm tra kích thước bundle JS/CSS so với performance budget. */
import * as fs from "fs";
import * as path from "path";
import type { PerfBudgetResult } from "../types.js";
import { normalizePath } from "./scanner.js";

export function checkPerfBudget(repo: string, budgetKb = 250): PerfBudgetResult {
  const candidates = [
    path.join(repo, ".next", "static"),
    path.join(repo, "dist"),
    path.join(repo, "build", "static"),
    path.join(repo, "build"),
  ];
  const bundles: PerfBudgetResult["bundles"] = [];
  for (const root of candidates) {
    if (!fs.existsSync(root)) continue;
    walkBundles(root, root, bundles, budgetKb);
  }
  if (bundles.length === 0) {
    return { found: false, bundles: [], summary: "Chua co bundle artifact (chay npm run build truoc). Tim trong .next/static, dist/, build/." };
  }
  bundles.sort((a, b) => b.sizeKb - a.sizeKb);
  const over = bundles.filter((b) => b.overBudget).length;
  return {
    found: true,
    bundles: bundles.slice(0, 15),
    summary: over === 0
      ? bundles.length + " bundle, lon nhat " + bundles[0]?.sizeKb + "KB (budget " + budgetKb + "KB)."
      : over + "/" + bundles.length + " bundle vuot budget " + budgetKb + "KB. Lon nhat: " + bundles[0]?.file + " (" + bundles[0]?.sizeKb + "KB).",
  };
}

function walkBundles(root: string, rel: string, bundles: PerfBudgetResult["bundles"], budgetKb: number) {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(rel, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = path.join(rel, entry.name);
    if (entry.isDirectory()) walkBundles(root, full, bundles, budgetKb);
    else if (/\.(js|css)$/.test(entry.name)) {
      try {
        const sizeKb = Math.round(fs.statSync(full).size / 1024);
        bundles.push({
          file: normalizePath(path.relative(root, full)),
          sizeKb,
          budgetKb,
          overBudget: sizeKb > budgetKb,
        });
      } catch { /* ignore */ }
    }
  }
}
