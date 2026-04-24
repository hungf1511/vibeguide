/** Discover installed Claude Code plugins và recommend tools dựa trên situation. */
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { PLUGIN_KEYWORDS } from "./pluginKeywords.js";
import { scoreSituation, matchKeywords } from "./scoreSituation.js";

export interface DiscoveredPlugin {
  name: string;
  description: string;
  version: string;
  installPath: string;
  enabled: boolean;
  mcpServers?: Record<string, { command: string; args: string[] }>;
}

/**
 * Lấy danh sách plugin user đã cài
 */
export function discoverInstalledPlugins(): DiscoveredPlugin[] {
  const plugins: DiscoveredPlugin[] = [];
  const home = homedir();
  const installedPath = join(home, ".claude", "plugins", "installed_plugins.json");

  let installedData: { plugins?: Record<string, any[]> } = {};
  try {
    installedData = JSON.parse(readFileSync(installedPath, "utf-8"));
  } catch {
    return plugins;
  }

  const enabledMap = getPluginEnabledMap();

  for (const [pluginKey, installs] of Object.entries(installedData.plugins || {})) {
    for (const install of installs) {
      const installPath = install.installPath as string;
      if (!installPath) continue;

      // Plugin mặc định enabled trừ khi user chủ động tắt (false)
      const explicitlyDisabled = enabledMap[pluginKey] === false;
      const isEnabled = !explicitlyDisabled;

      const pluginJsonPath = join(installPath, ".claude-plugin", "plugin.json");
      try {
        const manifest = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
        plugins.push({
          name: manifest.name || pluginKey.split("@")[0],
          description: manifest.description || "",
          version: install.version || manifest.version || "unknown",
          installPath,
          enabled: isEnabled,
          mcpServers: manifest.mcpServers,
        });
      } catch {
        plugins.push({
          name: pluginKey.split("@")[0],
          description: "",
          version: "unknown",
          installPath,
          enabled: isEnabled,
        });
      }
    }
  }

  return plugins;
}

function getPluginEnabledMap(): Record<string, boolean> {
  const home = homedir();
  const settingsPath = join(home, ".claude", "settings.local.json");
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    return settings.enabledPlugins || {};
  } catch {
    return {};
  }
}

/**
 * Recommend plugin + VibeGuide tool dựa trên situation.
 * Hỗ trợ cả tiếng Việt và tiếng Anh.
 */
export function recommendPluginsForSituation(
  situation: string,
  plugins: DiscoveredPlugin[]
): { plugins: Array<{ name: string; confidence: number; reason: string; description: string; command?: string }>; tools: Array<{ name: string; confidence: number; reason: string }>; detectedType: string } {
  const results: Array<{ name: string; confidence: number; reason: string; description: string; command?: string }> = [];
  const toolResults: Array<{ name: string; confidence: number; reason: string }> = [];

  // --- Phase 1: Match VibeGuide native tools ---
  const nativeToolNames = [
    "vibeguide_heuristic_bug",
    "vibeguide_trace_journey",
    "vibeguide_impact",
    "vibeguide_test_plan",
    "vibeguide_snapshot",
    "vibeguide_deploy_check",
    "vibeguide_suggest_fix",
    "vibeguide_changelog",
    "vibeguide_dependency_graph",
    "vibeguide_diff_summary",
    "vibeguide_what_changed",
    "vibeguide_regression",
    "vibeguide_scan_repo",
    "vibeguide_get_file",
    "vibeguide_get_deps",
    "vibeguide_type_check",
    "vibeguide_test_coverage",
    "vibeguide_circular_deps",
    "vibeguide_dead_code",
    "vibeguide_complexity",
    "vibeguide_a11y_check",
    "vibeguide_secret_scan",
    "vibeguide_i18n_gap",
    "vibeguide_doc_gap",
    "vibeguide_perf_budget",
    "vibeguide_monorepo_route",
    "vibeguide_review_pr",
    "vibeguide_founder_brief",
    "vibeguide_meeting_notes",
  ];

  for (const toolName of nativeToolNames) {
    const kws = PLUGIN_KEYWORDS[toolName] || [];
    const score = scoreSituation(situation, kws);
    if (score > 0.3) {
      toolResults.push({ name: toolName, confidence: score, reason: `Tình huống chứa từ khóa liên quan đến ${toolName.replace("vibeguide_", "")}` });
    }
  }

  // --- Phase 2: Match external plugins (chỉ enabled, chỉ keyword map) ---
  const seen = new Set<string>();
  for (const plugin of plugins) {
    if (!plugin.enabled) continue;

    // Chỉ dùng keyword dictionary — KHÔNG dùng description matching
    // để tránh nhiễu từ từ chung chung ("skills", "development", "interactive")
    const kws = PLUGIN_KEYWORDS[plugin.name];
    if (!kws || kws.length === 0) continue; // Plugin chưa có keyword map → skip

    const score = scoreSituation(situation, kws);
    if (score <= 0.3) continue;

    // Dedup theo tên plugin
    if (seen.has(plugin.name)) continue;
    seen.add(plugin.name);

    const matched = matchKeywords(situation, kws).slice(0, 3);
    results.push({
      name: plugin.name,
      confidence: score,
      reason: matched.length > 0 ? `Keyword match: ${matched.join(", ")}` : `Plugin ${plugin.name} phù hợp`,
      description: plugin.description,
      command: plugin.name.includes("-") ? `/${plugin.name.split("-")[0]}` : undefined,
    });
  }

  // --- Phase 3: Detect situation type ---
  const lower = situation.toLowerCase();
  let detectedType = "general";
  if (/chậm|load lâu|performance|fps|vitals/.test(lower)) detectedType = "performance";
  else if (/lỗi|bug|crash|error|không (chạy|ăn|hoạt động)/.test(lower)) detectedType = "bug";
  else if (/thanh toán|payment|checkout|thẻ|billing/.test(lower)) detectedType = "payment";
  else if (/ui|ux|design|giao diện|layout|css|theme/.test(lower)) detectedType = "frontend";
  else if (/security|bảo mật|xss|injection|auth/.test(lower)) detectedType = "security";
  else if (/database|sql|postgres|table|bảng/.test(lower)) detectedType = "database";
  else if (/deploy|release|production|đẩy lên/.test(lower)) detectedType = "deploy";
  else if (/test|kiểm thử|qa/.test(lower)) detectedType = "testing";
  else if (/ml|model|train|dataset|embedding/.test(lower)) detectedType = "ml";
  else if (/review|pr|pull request|merge/.test(lower)) detectedType = "code-review";

  // --- Phase 4: Fallback theo detectedType nếu chưa có tool nào ---
  if (toolResults.length === 0) {
    if (detectedType === "performance") {
      toolResults.push({ name: "vibeguide_trace_journey", confidence: 0.5, reason: "Trang chậm — trace journey để tìm entry point gây chậm" });
    } else if (detectedType === "bug") {
      toolResults.push({ name: "vibeguide_heuristic_bug", confidence: 0.5, reason: "Phát hiện lỗi — chạy heuristic bug scan" });
    } else if (detectedType === "payment") {
      toolResults.push({ name: "vibeguide_trace_journey", confidence: 0.5, reason: "Luồng thanh toán — trace journey để tìm điểm hỏng" });
    } else if (detectedType === "deploy") {
      toolResults.push({ name: "vibeguide_deploy_check", confidence: 0.5, reason: "Trước khi deploy — chạy deploy check" });
    } else if (detectedType === "security") {
      toolResults.push({ name: "vibeguide_heuristic_bug", confidence: 0.5, reason: "Bảo mật — scan bug patterns liên quan security" });
    }
  }

  // Sort + giới hạn top 3 để giảm nhiễu và token
  results.sort((a, b) => b.confidence - a.confidence);
  toolResults.sort((a, b) => b.confidence - a.confidence);

  return { plugins: results.slice(0, 3), tools: toolResults.slice(0, 3), detectedType };
}
