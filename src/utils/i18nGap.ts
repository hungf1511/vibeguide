/** Tìm key dịch thiếu/thừa giữa các locale file. */
import * as fs from "fs";
import * as path from "path";
import type { I18nGapResult } from "../types.js";

const LOCALE_GLOBS = [
  "src/locales", "src/i18n", "src/lang",
  "locales", "i18n", "lang",
  "public/locales",
];

export function findI18nGap(repo: string, baseLocale = "en"): I18nGapResult {
  const localeFiles = new Map<string, Set<string>>();

  for (const dir of LOCALE_GLOBS) {
    const full = path.join(repo, dir);
    if (!fs.existsSync(full)) continue;
    walkLocale(full, "", localeFiles);
  }

  if (localeFiles.size === 0) {
    return { baseLocale, locales: [], summary: "Khong tim thay file translation. Locales tim trong: " + LOCALE_GLOBS.join(", ") };
  }

  const baseKeys = localeFiles.get(baseLocale);
  if (!baseKeys) {
    const available = Array.from(localeFiles.keys());
    return { baseLocale, locales: [], summary: "Khong co locale base '" + baseLocale + "'. Locale co san: " + available.join(", ") };
  }

  const locales: I18nGapResult["locales"] = [];
  for (const [locale, keys] of localeFiles) {
    if (locale === baseLocale) continue;
    const missing: string[] = [];
    const extra: string[] = [];
    for (const k of baseKeys) if (!keys.has(k)) missing.push(k);
    for (const k of keys) if (!baseKeys.has(k)) extra.push(k);
    locales.push({ locale, missingKeys: missing.slice(0, 30), extraKeys: extra.slice(0, 30) });
  }

  const totalMissing = locales.reduce((s, l) => s + l.missingKeys.length, 0);
  const summary = totalMissing === 0
    ? "Cac locale " + locales.map((l) => l.locale).join(", ") + " day du so voi base '" + baseLocale + "'."
    : totalMissing + " key thieu giua cac locale (so voi base '" + baseLocale + "').";

  return { baseLocale, locales, summary };
}

function walkLocale(dir: string, sub: string, out: Map<string, Set<string>>) {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkLocale(full, sub ? sub + "/" + e.name : e.name, out);
    else if (e.name.endsWith(".json")) {
      const locale = e.name.replace(/\.json$/, "");
      try {
        const data = JSON.parse(fs.readFileSync(full, "utf-8"));
        const keys = new Set<string>();
        flattenKeys(data, "", keys);
        const existing = out.get(locale);
        if (existing) for (const k of keys) existing.add(k);
        else out.set(locale, keys);
      } catch { /* ignore */ }
    }
  }
}

function flattenKeys(obj: unknown, prefix: string, out: Set<string>) {
  if (obj === null || typeof obj !== "object") {
    out.add(prefix);
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? prefix + "." + k : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) flattenKeys(v, next, out);
    else out.add(next);
  }
}
