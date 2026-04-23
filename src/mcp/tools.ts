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
} from "./handlers/index.js";

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
    action: z.enum(["create", "list", "restore"]).optional().describe("Action: create (default), list, or restore."),
    label: z.string().optional().describe("Optional label for the snapshot, e.g. 'before-fix-payment'."),
    snapshotId: z.string().optional().describe("Snapshot ID required for restore action."),
  }),
  vibeguide_diff_summary: z.object({
    repoPath: repoPathSchema,
    since: z.enum(["git", "snapshot", "last"]).optional().describe("Compare against: git (default), snapshot, or last snapshot."),
    snapshotId: z.string().optional().describe("Snapshot ID required when since='snapshot'."),
  }),
  vibeguide_deploy_check: z.object({
    repoPath: repoPathSchema,
    checkBugPatterns: z.boolean().optional().describe("Scan for bug patterns. Default true."),
    checkUncommitted: z.boolean().optional().describe("Check for uncommitted git changes. Default true."),
    checkOrphans: z.boolean().optional().describe("Check for orphaned files. Default true."),
  }),
  vibeguide_suggest_fix: z.object({
    repoPath: repoPathSchema,
    filePath: z.string().describe("Path to the file with the bug."),
    patternId: z.string().optional().describe("Bug pattern ID. If omitted, scans file for all patterns."),
    line: z.number().optional().describe("Line number of the bug."),
  }),
  vibeguide_changelog: z.object({
    repoPath: repoPathSchema,
    count: z.number().optional().describe("Number of commits to include. Default 20."),
  }),
  vibeguide_dependency_graph: z.object({
    repoPath: repoPathSchema,
    format: z.enum(["mermaid", "json"]).optional().describe("Output format: mermaid (default) or json."),
  }),
  vibeguide_smart_route: z.object({
    situation: z.string().describe("Mô tả tình huống hiện tại, vd: 'UI chậm khi load trang', 'nút Thanh toán không ăn', 'deploy bị lỗi'"),
    repoPath: repoPathSchema,
  }),
};

const handlers: Record<string, (args: any) => Promise<any>> = {
  vibeguide_impact: handleImpact,
  vibeguide_trace_journey: handleTraceJourney,
  vibeguide_heuristic_bug: handleHeuristicBug,
  vibeguide_regression: handleRegression,
  vibeguide_scan_repo: handleScanRepo,
  vibeguide_test_plan: handleTestPlan,
  vibeguide_bug_report: handleBugReport,
  vibeguide_impact_confirm: handleImpactConfirm,
  vibeguide_what_changed: handleWhatChanged,
  vibeguide_get_file: handleGetFile,
  vibeguide_get_deps: handleGetDeps,
  vibeguide_snapshot: handleSnapshot,
  vibeguide_diff_summary: handleDiffSummary,
  vibeguide_deploy_check: handleDeployCheck,
  vibeguide_suggest_fix: handleSuggestFix,
  vibeguide_changelog: handleChangelog,
  vibeguide_dependency_graph: handleDepGraph,
  vibeguide_smart_route: handleSmartRoute,
};

export function registerTools(): any[] {
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

  const result = await handler(parsed.data);
  return {
    content: [
      {
        type: "text",
        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
      },
    ],
  };
}

function getToolDescription(name: string): string {
  const descriptions: Record<string, string> = {
    vibeguide_impact: "Analyze impact of changing a file: affected files, risk level, UI components.",
    vibeguide_trace_journey: "Trace user journey through codebase: entry points, files involved.",
    vibeguide_heuristic_bug: "Find bug patterns in repo based on symptom description.",
    vibeguide_regression: "Check regression after file changes: affected flows and test coverage.",
    vibeguide_scan_repo: "Scan repository structure and dependencies.",
    vibeguide_test_plan: "Generate test plan for a feature based on code structure.",
    vibeguide_bug_report: "Format bug report from user description with severity assessment.",
    vibeguide_impact_confirm: "Confirm impact before changes: affected features and estimated downtime.",
    vibeguide_what_changed: "Show recent changes: commits, files, affected features.",
    vibeguide_get_file: "Read file content safely (with path traversal guard).",
    vibeguide_get_deps: "Get dependency graph of the repository.",
    vibeguide_snapshot: "Create, list, or restore repo snapshots before/after changes.",
    vibeguide_diff_summary: "Summarize code changes in Vietnamese for non-tech users.",
    vibeguide_deploy_check: "Pre-deploy validation: bugs, uncommitted changes, orphans.",
    vibeguide_suggest_fix: "Suggest concrete code fixes for bug patterns found in files.",
    vibeguide_changelog: "Generate Vietnamese changelog from git history.",
    vibeguide_dependency_graph: "Export dependency graph as Mermaid markdown or JSON.",
    vibeguide_smart_route: "Smart routing: detect situation and recommend plugins/tools.",
  };
  return descriptions[name] || "";
}

function zodToJsonSchema(schema: z.ZodTypeAny): any {
  const zodType = schema as any;
  if (zodType._def?.typeName === "ZodObject") {
    const shape = zodType._def.shape();
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodTypeToJson(value as z.ZodTypeAny);
      if (!(value as any).isOptional?.()) {
        required.push(key);
      }
    }
    return { type: "object", properties, required };
  }
  return {};
}

function zodTypeToJson(z: z.ZodTypeAny): any {
  const def = (z as any)._def;
  switch (def?.typeName) {
    case "ZodString":
      return { type: "string", description: def.description };
    case "ZodNumber":
      return { type: "number", description: def.description };
    case "ZodBoolean":
      return { type: "boolean", description: def.description };
    case "ZodArray":
      return { type: "array", items: zodTypeToJson(def.type), description: def.description };
    case "ZodOptional":
      return zodTypeToJson(def.innerType);
    default:
      return {};
  }
}
