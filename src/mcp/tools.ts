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
  vibeguide_session_status: z.object({
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

interface ZodInternal {
  _def?: {
    typeName?: string;
    shape?: () => Record<string, z.ZodTypeAny>;
    type?: z.ZodTypeAny;
    innerType?: z.ZodTypeAny;
    description?: string;
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
      if (!(value as unknown as ZodInternal).isOptional?.()) {
        required.push(key);
      }
    }
    return { type: "object", properties, required };
  }
  return {};
}

function zodTypeToJson(z: z.ZodTypeAny): unknown {
  const def = (z as unknown as ZodInternal)._def;
  switch (def?.typeName) {
    case "ZodString":
      return { type: "string", description: def?.description };
    case "ZodNumber":
      return { type: "number", description: def?.description };
    case "ZodBoolean":
      return { type: "boolean", description: def?.description };
    case "ZodArray":
      return { type: "array", items: def?.type ? zodTypeToJson(def.type) : {}, description: def?.description };
    case "ZodOptional":
      return def?.innerType ? zodTypeToJson(def.innerType) : {};
    default:
      return {};
  }
}
