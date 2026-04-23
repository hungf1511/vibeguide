import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface DiscoveredPlugin {
  name: string;
  description: string;
  version: string;
  installPath: string;
  enabled: boolean;
  mcpServers?: Record<string, { command: string; args: string[] }>;
}

/** Keywords tiếng Việt + Anh cho từng plugin —
 *  Người dùng không cần nhớ tên plugin, chỉ cần mô tả tình huống. */
const PLUGIN_KEYWORDS: Record<string, string[]> = {
  "chrome-devtools-mcp": [
    "chậm",
    "load lâu",
    "ui chậm",
    "performance",
    "web vitals",
    "lighthouse",
    "audit",
    "fps",
    "render",
    "chrome",
    "devtools",
    "mạng",
    "network",
    "memory leak",
    "screenshot",
    "screenshot full page",
    "console",
    "lcp",
    "cls",
    "inp",
    "core web vitals",
    "tối ưu",
    "optimize",
  ],
  "gitnexus": [
    "codebase",
    "repo",
    "architecture",
    "refactor",
    "tìm file",
    "impact",
    "dependency",
    "code graph",
    "knowledge graph",
    "cypher",
    "query",
    "tác động",
    "đổi tên",
    "rename",
    "cross-repo",
    "module",
  ],
  "stripe": [
    "thanh toán",
    "payment",
    "checkout",
    "thẻ",
    "billing",
    "subscription",
    "invoice",
    "charge",
    "refund",
    "stripe",
    "giá",
    "pricing",
  ],
  "supabase": [
    "database",
    "sql",
    "postgres",
    "auth",
    "realtime",
    "lưu trữ",
    "bảng",
    "table",
    "row level security",
    "rls",
    "function",
    "edge",
    "storage",
    "bucket",
    "supabase",
  ],
  "huggingface-skills": [
    "ml",
    "model",
    "train",
    "dataset",
    "inference",
    "embedding",
    "fine-tune",
    "hugging face",
    "transformers",
    "gradio",
    "vision",
    "nlp",
    "ai model",
    "thử nghiệm model",
  ],
  "code-review": [
    "review",
    "pr",
    "pull request",
    "merge",
    "code review",
    "đánh giá code",
    "duyệt",
    "approve",
    "reject",
  ],
  "feature-dev": [
    "feature",
    "tính năng",
    "implement",
    "development",
    "phát triển",
    "build feature",
    "thiết kế feature",
    "plan",
    "blueprint",
  ],
  "superpowers": [
    "plan",
    "debug",
    "test",
    "tdd",
    "skill",
    "superpowers",
    "lập kế hoạch",
    "ghi nhớ",
    "agent skill",
    "workflow",
  ],
  "frontend-design": [
    "ui",
    "ux",
    "design",
    "giao diện",
    "layout",
    "css",
    "responsive",
    "component",
    "theme",
    "dark mode",
    "color",
    "typography",
    "spacing",
    "frontend",
    "figma",
  ],
  "security-guidance": [
    "security",
    "xss",
    "injection",
    "auth",
    "bảo mật",
    "lỗ hổng",
    "vulnerability",
    "scan",
    "pen test",
    "safe",
    "sanitize",
    "escape",
    "csrf",
    "cors",
  ],
  "firecrawl": [
    "crawl",
    "scrape",
    "web",
    "search",
    "content",
    "trích xuất",
    "extract",
    "markdown",
    "url",
    "fetch",
    "data extraction",
    "database",
  ],
  "fiftyone": [
    "dataset",
    "image",
    "computer vision",
    "annotation",
    "cv",
    "object detection",
    "classification",
    "segmentation",
    "visualize",
    "plot",
    "histogram",
    "embedding",
    "相似",
    "duplicate",
  ],
  "sentry": [
    "sentry",
    "error tracking",
    "monitor",
    "alert",
    "crash",
    "exception",
    "log",
    "debug production",
    " incident",
    "oncall",
  ],
  "linear": [
    "linear",
    "task",
    "ticket",
    "issue",
    "project management",
    "backlog",
    "sprint",
    "roadmap",
    "assign",
    "priority",
  ],
  "gitlab": [
    "gitlab",
    "ci/cd",
    "pipeline",
    "merge request",
    "repository",
    "self-hosted",
    "runner",
    "deploy",
  ],
  "serena": [
    "serena",
    "context",
    "memory",
    "session",
    "recall",
    "lưu trạng thái",
    "resume",
  ],
  "greptile": [
    "greptile",
    "codebase chat",
    "ask code",
    "understand",
    "giải thích code",
    "tìm hiểu",
    "navigate",
  ],
  "firebase": [
    "firebase",
    "hosting",
    "firestore",
    "cloud function",
    "mobile",
    "push notification",
    "analytics",
    "crashlytics",
  ],
  "hookify": [
    "hook",
    "rule",
    "prevent",
    "block",
    "guard",
    "ngăn chặn",
    "quy tắc",
    "tự động kiểm tra",
  ],
  "ralph-loop": [
    "loop",
    "recurring",
    "schedule",
    "cron",
    "repeat",
    "lặp lại",
    "định kỳ",
    "tự động chạy",
  ],
  "vibeguide_scan_repo": [
    "quét",
    "scan",
    "repo",
    "structure",
    "cấu trúc",
    "liệt kê file",
    "folder",
    "overview",
    "không biết",
    "codebase",
    "có gì",
    "tổng quan",
    "danh sách file",
    "khám phá",
  ],
  "vibeguide_heuristic_bug": [
    "lỗi",
    "crash",
    "error",
    "fix",
    "sửa",
    "không chạy",
    "không ăn",
    "bị lỗi",
    "fail",
    "proxy",
    "connection",
    "socks",
    "timeout",
    "refuse",
    "không kết nối",
    "mất kết nối",
  ],
  "vibeguide_trace_journey": [
    "luồng",
    "journey",
    "flow",
    "entry point",
    "user click",
    "người dùng bấm",
    "tương tác",
    "hành trình",
    "trace",
    "theo dõi",
  ],
  "vibeguide_impact": [
    "ảnh hưởng",
    "impact",
    "risk",
    "thay đổi",
    "đụng chạm",
    "affected files",
    "liên quan",
    "đụng",
    "scope",
    "phạm vi",
  ],
  "vibeguide_test_plan": [
    "test",
    "kiểm thử",
    "plan",
    "test case",
    "qa",
    "kiểm tra",
    "hướng dẫn test",
    "founder test",
    "kịch bản test",
    "fix",
  ],
  "vibeguide_snapshot": [
    "snapshot",
    "backup",
    "rollback",
    "phục hồi",
    "chụp",
    "lưu trạng thái",
    "trước khi sửa",
    "điểm phục hồi",
  ],
  "vibeguide_deploy_check": [
    "deploy",
    "production",
    "release",
    "đẩy lên",
    "kiểm tra trước deploy",
    "pre-deploy",
    "production ready",
    "orphan",
    "file chết",
    "không dùng",
    "uncommitted",
    "bug pattern",
  ],
  "vibeguide_suggest_fix": [
    "sửa",
    "fix",
    "code suggestion",
    "gợi ý sửa",
    "autofix",
    "correct",
    "patch",
    "refactor suggestion",
  ],
  "vibeguide_changelog": [
    "changelog",
    "history",
    "commit log",
    "thay đổi",
    "release note",
    "version",
    "update log",
    "lịch sử",
    "commit",
  ],
  "vibeguide_dependency_graph": [
    "dependency",
    "graph",
    "mermaid",
    "diagram",
    "sơ đồ",
    "liên kết",
    "import",
    "module graph",
    "visualize dependency",
  ],
  "vibeguide_diff_summary": [
    "diff",
    "so sánh",
    "thay đổi",
    "tóm tắt thay đổi",
    "code review diff",
    "what changed",
  ],
  "vibeguide_what_changed": [
    "what changed",
    "recent",
    "commit gần đây",
    "vừa sửa",
    "mới thay đổi",
    "recent commits",
    "thay đổi gần đây",
  ],
  "vibeguide_regression": [
    "regression",
    "lùi",
    "hỏng lại",
    "test lại",
    "kiểm tra hồi quy",
    "affected flows",
    "kiểm tra lại",
  ],
  "vibeguide_get_file": [
    "đọc file",
    "xem code",
    "file content",
    "nội dung file",
    "mở file",
    "read file",
  ],
  "vibeguide_get_deps": [
    "dependency graph",
    "deps",
    "import",
    "module",
    "phụ thuộc",
    "liên kết file",
  ],
};

/** Tính điểm match giữa situation và keywords */
function scoreSituation(situation: string, keywords: string[]): number {
  const lower = situation.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) hits++;
  }
  if (hits === 0) return 0;
  // Normalize: nhiều keyword match → confidence cao hơn nhưng saturate ở ~0.95
  return Math.min(0.95, 0.4 + hits * 0.15);
}

/** Lấy danh sách plugin user đã cài */
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

    const matched = kws.filter(k => situation.toLowerCase().includes(k)).slice(0, 3);
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
