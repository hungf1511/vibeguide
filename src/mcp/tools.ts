/** Central tool registry — định nghĩa 34 MCP tools với Zod schemas và bilingual descriptions. */
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
  handleGitStatus,
  handleGitLog,
} from "./handlers/index.js";
import { logEvent } from "../utils/sessionContext.js";
import { getToolDescription } from "./toolDescriptions.js";
import { compressOutput } from "./toolOutput.js";
import { schemas } from "./toolSchemas.js";
import { zodToJsonSchema } from "./zodJsonSchema.js";

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
  vibeguide_git_status: handleGitStatus as unknown as (args: unknown) => Promise<unknown>,
  vibeguide_git_log: handleGitLog as unknown as (args: unknown) => Promise<unknown>,
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
