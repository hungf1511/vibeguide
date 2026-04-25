/** Language analyzer support report. */
import type { LanguageSupportResult } from "../../types.js";
import { getLanguageSupport } from "../../analyzers/registry.js";
import { loadConfig } from "../../utils/configLoader.js";
import { resolveRepo } from "../../utils/pathGuard.js";

/** MCP handler for reporting active language analyzers. */
export async function handleLanguageSupport(args: { repoPath?: string }): Promise<LanguageSupportResult> {
  const repo = resolveRepo(args.repoPath);
  const config = loadConfig(repo);
  const backend = readParserBackend(config.parser.backend);
  const legacyParser = config.parser.legacyParser || process.env.VIBEGUIDE_LEGACY_PARSER === "1";
  const analyzers = getLanguageSupport(repo, { backend, legacyParser });
  const activeLanguages = analyzers.filter((item) => item.active).map((item) => item.language);
  const activeTreeSitter = analyzers.filter((item) => item.active && item.strategy === "tree-sitter-wasm").length;
  return {
    analyzers,
    activeLanguages,
    summary: `${activeLanguages.length}/${analyzers.length} analyzer active (${backend}${legacyParser ? ", legacy" : ""}; ${activeTreeSitter} tree-sitter-wasm): ${activeLanguages.join(", ") || "none"}.`,
  };
}

function readParserBackend(value: "static" | "tree-sitter"): "static" | "tree-sitter" {
  const envValue = process.env.VIBEGUIDE_PARSER_BACKEND;
  return envValue === "tree-sitter" || envValue === "static" ? envValue : value;
}
