/** Central tool registry — định nghĩa 34 MCP tools với Zod schemas và bilingual descriptions. */
import { z } from "zod";
import {
  handleImpact,
  handleTraceJourney,
  handleHeuristicBug,
  handleRegression,
  handleScanRepo,
  handleTestPlan,
  handleBugReport,
  handleImpactConfirm,
  handleWhatChanged,
  handleGetFile,
  handleGetDeps,
  handleSnapshot,
  handleDiffSummary,
  handleDeployCheck,
  handleSuggestFix,
  handleChangelog,
  handleDepGraph,
  handleSmartRoute,
  handleSessionStatus,
  handleExportReport,
  handleTypeCheck,
  handleTestCoverage,
  handleCircularDeps,
  handleDeadCode,
  handleComplexity,
  handleA11yCheck,
  handleSecretScanV2,
  handleI18nGap,
  handleDocGap,
  handlePerfBudget,
  handleMonorepoRoute,
  handleReviewPr,
  handleFounderBrief,
  handleMeetingNotes,
} from "./handlers/index.js";
import { logEvent } from "../utils/sessionContext.js";

const repoPathSchema = z.string().optional().describe("Absolute path to the repository. Defaults to current working directory.");

const schemas: Record<string, z.ZodTypeAny> = {
  vibeguide_impact: z.object({
    filePath: z.string().describe("Path to the file being changed."),
    repoPath: repoPathSchema,
  }),
  vibeguide_trace_journey: z.object({
    journey: z.string().describe("User journey description, e.g. 'user clicks Pay button'"),
    repoPath: repoPathSchema,
  }),
  vibeguide_heuristic_bug: z.object({
    symptom: z.string().describe("Bug symptom description, e.g. 'login fails with 401'"),
    repoPath: repoPathSchema,
  }),
  vibeguide_regression: z.object({
    changedFiles: z.array(z.string()).describe("List of files that were changed."),
    repoPath: repoPathSchema,
  }),
  vibeguide_scan_repo: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_test_plan: z.object({
    feature: z.string().describe("Feature name to generate test plan for."),
    repoPath: repoPathSchema,
  }),
  vibeguide_bug_report: z.object({
    description: z.string().describe("Bug description from user."),
    repoPath: repoPathSchema,
  }),
  vibeguide_impact_confirm: z.object({
    filePath: z.string().describe("Path to the file being changed."),
    repoPath: repoPathSchema,
  }),
  vibeguide_what_changed: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_get_file: z.object({
    filePath: z.string().describe("Path to the file to read."),
    repoPath: repoPathSchema,
  }),
  vibeguide_get_deps: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_snapshot: z.object({
    repoPath: repoPathSchema,
    action: z.enum(["create", "list", "restore"]).optional().default("create").describe("Action: create (default), list, or restore."),
    label: z.string().optional().describe("Optional label for the snapshot, e.g. 'before-fix-payment'."),
    snapshotId: z.string().optional().describe("Snapshot ID required for restore action."),
  }),
  vibeguide_diff_summary: z.object({
    repoPath: repoPathSchema,
    since: z.enum(["git", "snapshot", "last"]).optional().default("git").describe("Compare against: git (default), snapshot, or last snapshot."),
    snapshotId: z.string().optional().describe("Snapshot ID required when since='snapshot'."),
  }),
  vibeguide_deploy_check: z.object({
    repoPath: repoPathSchema,
    checkBugPatterns: z.boolean().optional().default(true).describe("Scan for bug patterns. Default true."),
    checkUncommitted: z.boolean().optional().default(true).describe("Check for uncommitted git changes. Default true."),
    checkOrphans: z.boolean().optional().default(true).describe("Check for orphaned files. Default true."),
  }),
  vibeguide_suggest_fix: z.object({
    repoPath: repoPathSchema,
    filePath: z.string().describe("Path to the file with the bug."),
    patternId: z.string().optional().describe("Bug pattern ID. If omitted, scans file for all patterns."),
    line: z.number().optional().describe("Line number of the bug."),
  }),
  vibeguide_changelog: z.object({
    repoPath: repoPathSchema,
    count: z.number().optional().default(20).describe("Number of commits to include. Default 20."),
  }),
  vibeguide_dependency_graph: z.object({
    repoPath: repoPathSchema,
    format: z.enum(["mermaid", "json"]).optional().default("mermaid").describe("Output format: mermaid (default) or json."),
  }),
  vibeguide_smart_route: z.object({
    situation: z.string().describe("Mô tả tình huống hiện tại, vd: 'UI chậm khi load trang', 'nút Thanh toán không ăn', 'deploy bị lỗi'"),
    repoPath: repoPathSchema,
  }),
  vibeguide_session_status: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_export_report: z.object({
    repoPath: repoPathSchema,
    format: z.enum(["markdown", "json", "text"]).optional().describe("Output format: markdown, json, or text. Defaults to config outputFormat."),
    saveToFile: z.boolean().optional().default(false).describe("Save report to file in repo directory. Default false."),
  }),
  vibeguide_type_check: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_test_coverage: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_circular_deps: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_dead_code: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_complexity: z.object({
    repoPath: repoPathSchema,
    thresholdLoc: z.number().optional().default(300).describe("Lines of code threshold. Default 300."),
    thresholdComplexity: z.number().optional().default(15).describe("Cyclomatic complexity threshold. Default 15."),
  }),
  vibeguide_a11y_check: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_secret_scan: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_i18n_gap: z.object({
    repoPath: repoPathSchema,
    baseLocale: z.string().optional().default("en").describe("Base locale to compare against, e.g. 'en'. Default 'en'."),
  }),
  vibeguide_doc_gap: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_perf_budget: z.object({
    repoPath: repoPathSchema,
    budgetKb: z.number().optional().default(500).describe("Bundle size budget in KB. Default 500."),
  }),
  vibeguide_monorepo_route: z.object({
    repoPath: repoPathSchema,
    changedFiles: z.array(z.string()).optional().describe("List of changed files to scope monorepo impact."),
  }),
  vibeguide_review_pr: z.object({
    repoPath: repoPathSchema,
    filePath: z.string().optional().describe("Path to a file being changed (for impact analysis)."),
    feature: z.string().optional().describe("Feature name (for test plan generation)."),
  }),
  vibeguide_founder_brief: z.object({
    repoPath: repoPathSchema,
    days: z.number().optional().default(7).describe("Number of days to look back. Default 7."),
  }),
  vibeguide_meeting_notes: z.object({
    repoPath: repoPathSchema,
  }),
};

const handlers: Record<string, (args: unknown) => Promise<unknown>> = {
  vibeguide_impact: handleImpact as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_trace_journey: handleTraceJourney as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_heuristic_bug: handleHeuristicBug as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_regression: handleRegression as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_scan_repo: handleScanRepo as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_test_plan: handleTestPlan as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_bug_report: handleBugReport as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_impact_confirm: handleImpactConfirm as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_what_changed: handleWhatChanged as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_get_file: handleGetFile as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_get_deps: handleGetDeps as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_snapshot: handleSnapshot as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_diff_summary: handleDiffSummary as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_deploy_check: handleDeployCheck as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_suggest_fix: handleSuggestFix as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_changelog: handleChangelog as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_dependency_graph: handleDepGraph as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_smart_route: handleSmartRoute as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_session_status: handleSessionStatus as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_export_report: handleExportReport as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_type_check: handleTypeCheck as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_test_coverage: handleTestCoverage as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_circular_deps: handleCircularDeps as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_dead_code: handleDeadCode as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_complexity: handleComplexity as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_a11y_check: handleA11yCheck as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_secret_scan: handleSecretScanV2 as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_i18n_gap: handleI18nGap as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_doc_gap: handleDocGap as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_perf_budget: handlePerfBudget as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_monorepo_route: handleMonorepoRoute as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_review_pr: handleReviewPr as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_founder_brief: handleFounderBrief as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_meeting_notes: handleMeetingNotes as unknown as (args: unknown) => Promise<unknown>,
};

export function registerTools(): { name: string; description: string; inputSchema: unknown }[] {
  return Object.entries(schemas).map(([name, schema]) => ({
    name,
    description: getToolDescription(name),
    inputSchema: zodToJsonSchema(schema),
  }));
}

export async function handleToolCall(name: string, args: unknown): Promise<any> {
  const handler = handlers[name];
  const schema = schemas[name];
  if (!handler || !schema) {
    throw new Error(`Unknown tool: ${name}`);
  }

  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid arguments: ${parsed.error.message}`);
  }

  let result: unknown;
  try {
    result = await handler(parsed.data);
  } catch (err) {
    throw err;
  }

  // Log to session context for timeline tracking
  const repoPath = (parsed.data as Record<string, unknown>)?.repoPath as string | undefined;
  if (repoPath) {
    logEvent(repoPath, {
      timestamp: new Date().toISOString(),
      tool: name,
      input: parsed.data as Record<string, unknown>,
      output: typeof result === "string" ? { text: result } : (result as Record<string, unknown>),
    });
  }

  // Smart context budget: auto-compress output if too large
  const json = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  const tokenEstimate = Math.ceil(json.length / 4); // ~4 chars per token
  const BUDGET = 4000; // ~4K tokens per tool response
  let output = json;
  if (tokenEstimate > BUDGET) {
    output = compressOutput(result, BUDGET * 4);
  }

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

/** Compress output to fit context budget by truncating arrays and removing verbose fields */
function compressOutput(result: unknown, maxChars: number): string {
  if (typeof result === "string") return result.slice(0, maxChars) + "\n... [truncated]";
  const obj = result as Record<string, unknown>;
  const compressed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      if (value.length > 10) {
        compressed[key] = value.slice(0, 10);
        compressed[`${key}Total`] = value.length;
        compressed[`${key}Note`] = `Showing top 10 of ${value.length}. Use specific tool to see more.`;
      } else {
        compressed[key] = value;
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const sub = value as Record<string, unknown>;
      const subJson = JSON.stringify(sub);
      if (subJson.length > 500) {
        compressed[key] = `{ ... truncated (${Object.keys(sub).length} keys) }`;
        compressed[`${key}Keys`] = Object.keys(sub).slice(0, 10);
      } else {
        compressed[key] = value;
      }
    } else {
      compressed[key] = value;
    }
  }
  let output = JSON.stringify(compressed, null, 2);
  if (output.length > maxChars) {
    output = output.slice(0, maxChars) + "\n... [output truncated to fit context budget]";
  }
  return output;
}

function getToolDescription(name: string): string {
  const descriptions: Record<string, string> = {
    vibeguide_impact: "Analyze impact of changing a file — Phân tích ảnh hưởng khi thay đổi file: affected files, risk level, UI components.",
    vibeguide_trace_journey: "Trace user journey — Theo dõi hành trình người dùng: entry points, files involved.",
    vibeguide_heuristic_bug: "Find bug patterns — Tìm lỗi theo mô tả triệu chứng.",
    vibeguide_regression: "Check regression — Kiểm tra hồi quy sau thay đổi: affected flows, test coverage.",
    vibeguide_scan_repo: "Scan repository — Quét cấu trúc và dependency của repo.",
    vibeguide_test_plan: "Generate test plan — Tạo kịch bản kiểm thử cho tính năng.",
    vibeguide_bug_report: "Format bug report — Định dạng báo cáo lỗi với mức độ nghiêm trọng.",
    vibeguide_impact_confirm: "Confirm impact — Xác nhận ảnh hưởng trước khi sửa: features, downtime.",
    vibeguide_what_changed: "Show recent changes — Hiển thị thay đổi gần đây: commits, files, features.",
    vibeguide_get_file: "Read file — Đọc nội dung file an toàn (chống path traversal).",
    vibeguide_get_deps: "Get dependency graph — Lấy đồ thị phụ thuộc của repo.",
    vibeguide_snapshot: "Snapshot — Chụp, liệt kê, hoặc khôi phục snapshot trước/sau thay đổi.",
    vibeguide_diff_summary: "Diff summary — Tóm tắt thay đổi code bằng tiếng Việt cho non-tech.",
    vibeguide_deploy_check: "Deploy check — Kiểm tra trước deploy: bug, uncommitted, orphan files.",
    vibeguide_suggest_fix: "Suggest fix — Gợi ý sửa code cụ thể cho bug patterns.",
    vibeguide_changelog: "Changelog — Tạo changelog tiếng Việt từ lịch sử git.",
    vibeguide_dependency_graph: "Dependency graph — Xuất đồ thị phụ thuộc dạng Mermaid hoặc JSON.",
    vibeguide_smart_route: "Smart route — Định tuyến thông minh: phát hiện tình huống, gợi ý plugin/tool.",
    vibeguide_export_report: "Export report — Xuất timeline session dạng Markdown, JSON, hoặc text.",
    vibeguide_type_check: "Type check — Chạy kiểm tra TypeScript và báo lỗi bằng tiếng Việt.",
    vibeguide_test_coverage: "Test coverage — Đọc báo cáo độ phủ test và liệt kê file yếu.",
    vibeguide_circular_deps: "Circular deps — Tìm vòng lặp import trong đồ thị phụ thuộc.",
    vibeguide_dead_code: "Dead code — Tìm export không dùng và file orphan.",
    vibeguide_complexity: "Complexity — Phân tích độ phức tạp code (LOC + cyclomatic).",
    vibeguide_a11y_check: "Accessibility — Quét lỗi tiếp cận cơ bản: alt, aria-label, href, label.",
    vibeguide_secret_scan: "Secret scan — Quét secret, API key, credential trong source.",
    vibeguide_i18n_gap: "i18n gap — Tìm key dịch thiếu/thừa giữa các locale.",
    vibeguide_doc_gap: "Doc gap — Tìm file thiếu README và export thiếu JSDoc.",
    vibeguide_perf_budget: "Perf budget — Kiểm tra kích thước bundle so với ngân sách performance.",
    vibeguide_monorepo_route: "Monorepo — Phát hiện monorepo manager và liệt kê package bị ảnh hưởng.",
    vibeguide_review_pr: "Review PR — Kiểm tra pre-merge: type, bug, secret, circular deps, impact.",
    vibeguide_founder_brief: "Founder brief — Tạo báo cáo tuần thân thiện cho founder.",
    vibeguide_meeting_notes: "Meeting notes — Tạo biên bản họp từ session context (done, in-progress, blockers).",
  };
  return descriptions[name] || "";
}

interface ZodInternal {
  _def?: {
    typeName?: string;
    shape?: () => Record<string, z.ZodTypeAny>;
    type?: z.ZodTypeAny;
    innerType?: z.ZodTypeAny;
    description?: string;
    values?: string[];
    value?: unknown;
    defaultValue?: () => unknown;
  };
  isOptional?: () => boolean;
}

function zodToJsonSchema(schema: z.ZodTypeAny): unknown {
  const zodType = schema as unknown as ZodInternal;
  if (zodType._def?.typeName === "ZodObject" && zodType._def.shape) {
    const shape = zodType._def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodTypeToJson(value);
      if (isRequired(value)) {
        required.push(key);
      }
    }
    return { type: "object", properties, required };
  }
  return {};
}

function isRequired(schema: z.ZodTypeAny): boolean {
  const def = (schema as unknown as ZodInternal)._def;
  if (def?.typeName === "ZodOptional" || def?.typeName === "ZodDefault") return false;
  return !(schema as unknown as ZodInternal).isOptional?.();
}

function zodTypeToJson(z: z.ZodTypeAny): unknown {
  const def = (z as unknown as ZodInternal)._def;
  const withDescription = (schema: Record<string, unknown>) => {
    if (def?.description) schema.description = def.description;
    return schema;
  };
  switch (def?.typeName) {
    case "ZodString":
      return withDescription({ type: "string" });
    case "ZodNumber":
      return withDescription({ type: "number" });
    case "ZodBoolean":
      return withDescription({ type: "boolean" });
    case "ZodEnum":
      return withDescription({ type: "string", enum: def?.values || [] });
    case "ZodLiteral":
      return withDescription({ const: def?.value, type: typeof def?.value });
    case "ZodArray":
      return withDescription({ type: "array", items: def?.type ? zodTypeToJson(def.type) : {} });
    case "ZodOptional":
      return def?.innerType ? withDescription(zodTypeToJson(def.innerType) as Record<string, unknown>) : {};
    case "ZodDefault": {
      const schema = def?.innerType ? (zodTypeToJson(def.innerType) as Record<string, unknown>) : {};
      if (def?.defaultValue) schema.default = def.defaultValue();
      return withDescription(schema);
    }
    case "ZodNullable": {
      const schema = def?.innerType ? (zodTypeToJson(def.innerType) as Record<string, unknown>) : {};
      schema.nullable = true;
      return withDescription(schema);
    }
    case "ZodObject":
      return zodToJsonSchema(z);
    default:
      return withDescription({});
  }
}
