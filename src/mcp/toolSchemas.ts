/** Zod input schemas for all VibeGuide MCP tools. */
import { z } from "zod";

const repoPathSchema = z.string().optional().describe("Absolute path to the repository. Defaults to current working directory.");
const scopeSchema = z.object({
  paths: z.array(z.string()).optional().describe("Limit analysis to these repo-relative paths."),
  since: z.string().optional().describe("Limit analysis to files changed after this git date/revision."),
  until: z.string().optional().describe("Limit analysis to files changed before this git date/revision."),
}).optional().describe("Optional analysis scope for large repos.");

/** Zod schemas for all MCP tool inputs. */
export const schemas: Record<string, z.ZodTypeAny> = {
  vibeguide_impact: z.object({
    filePath: z.string().describe("Path to the file being changed."),
    repoPath: repoPathSchema,
    scope: scopeSchema,
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
    scope: scopeSchema,
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
    scope: scopeSchema,
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
    scope: scopeSchema,
  }),
  vibeguide_language_support: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_smart_route: z.object({
    situation: z.string().describe("MÃ´ táº£ tÃ¬nh huá»‘ng hiá»‡n táº¡i, vd: 'UI cháº­m khi load trang', 'nÃºt Thanh toÃ¡n khÃ´ng Äƒn', 'deploy bá»‹ lá»—i'"),
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
  vibeguide_git_status: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_git_log: z.object({
    repoPath: repoPathSchema,
    count: z.number().optional().default(20).describe("Number of commits to return. Default 20."),
    since: z.string().optional().describe("Show commits more recent than a specific date (ISO 8601)."),
    until: z.string().optional().describe("Show commits older than a specific date (ISO 8601)."),
    showFiles: z.boolean().optional().default(false).describe("Include changed files per commit. Default false."),
  }),
  vibeguide_index_build: z.object({
    repoPath: repoPathSchema,
    force: z.boolean().optional().describe("Force rebuild by deleting existing index."),
  }),
  vibeguide_index_status: z.object({
    repoPath: repoPathSchema,
  }),
  vibeguide_index_clear: z.object({
    repoPath: repoPathSchema,
  }),
};


