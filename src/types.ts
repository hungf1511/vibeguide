export interface TreeNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: TreeNode[];
}

export interface DepEdge {
  from: string;
  to: string;
}

export interface DepGraph {
  nodes: string[];
  edges: DepEdge[];
}

export interface ImpactResult {
  filePath: string;
  risk: "low" | "medium" | "high";
  affectedFiles: AffectedFile[];
  indirectFiles: IndirectFile[];
  features: string[];
  rollbackTime: string;
  needsApproval: boolean;
  /** Hierarchical view for large repos — grouped by module instead of raw file list */
  hierarchical?: HierarchicalImpact;
  /** Entry points (routes/pages) at risk from this change */
  entryPointsAtRisk?: string[];
  /** Auto-snapshot ID created before impact analysis */
  autoSnapshotId?: string;
}

export interface HierarchicalImpact {
  direct: { count: number; topFiles: string[]; modules: Record<string, number> };
  indirect: { count: number; modules: Record<string, number> };
  summary: string;
}

export interface AffectedFile {
  file: string;
  ui?: string;
  buttons?: string[];
  confidence: number;
}

export interface IndirectFile {
  file: string;
  via: string;
  ui?: string;
  confidence: number;
}

export interface BugMatch {
  pattern: string;
  file: string;
  line?: number;
  score: number;
}

export interface RegressionResult {
  testFlows: TestFlow[];
  passed: boolean;
}

export interface TestFlow {
  name: string;
  files: string[];
  passed: boolean;
}

export interface TestPlan {
  feature: string;
  steps: string[];
  expect: string[];
}

export interface BugReport {
  formatted: string;
  steps: string[];
  severity: "low" | "medium" | "high" | "critical";
}

export interface ChangeLog {
  commits: string[];
  files: string[];
  features: string[];
}

export interface SnapshotResult {
  snapshotId: string;
  fileCount: number;
  timestamp: string;
  label?: string;
  restored?: boolean;
  filesChanged?: number;
  snapshots?: { id: string; label?: string; timestamp: string; fileCount: number }[];
}

export interface DiffSummaryResult {
  summary: string;
  filesChanged: DiffFile[];
  riskAssessment: string;
  totalFiles: number;
}

export interface DiffFile {
  file: string;
  changeType: "added" | "modified" | "deleted";
  description: string;
}

export interface DeployCheckResult {
  passed: boolean;
  checks: DeployCheck[];
  summary: string;
}

export interface DeployCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: "info" | "warning" | "high" | "critical";
}

export interface FixSuggestionResult {
  filePath: string;
  suggestions: FixSuggestion[];
}

export interface FixSuggestion {
  line: number;
  original: string;
  fixed: string;
  explanation: string;
}

export interface ChangelogResult {
  version: string;
  date: string;
  sections: ChangelogSection[];
  raw: string;
}

export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface DependencyGraphResult {
  mermaid: string;
  nodes: number;
  edges: number;
}

export interface SmartRouteResult {
  situation: string;
  detectedType: string;
  recommendedPlugins: SmartRoutePlugin[];
  vibeGuideTools: SmartRouteTool[];
  summary: string;
}

export interface SmartRoutePlugin {
  name: string;
  description: string;
  confidence: number;
  reason: string;
  command?: string;
}

export interface SmartRouteTool {
  name: string;
  confidence: number;
  reason: string;
}

export interface ExportReportResult {
  report: string;
  filePath?: string;
  format: "markdown" | "json" | "text";
}

// --- New tool types ---
export interface TypeCheckResult {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  errors: TypeError[];
  summary: string;
  durationMs: number;
}

export interface TypeError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  messageVi?: string;
}

export interface TestCoverageResult {
  found: boolean;
  source?: string;
  totals?: { lines: number; branches: number; functions: number; statements: number };
  weakFiles: { file: string; lines: number }[];
  summary: string;
}

export interface CircularDepsResult {
  cycleCount: number;
  cycles: string[][];
  summary: string;
}

export interface DeadCodeResult {
  unusedExports: { file: string; symbol: string }[];
  orphanFiles: string[];
  summary: string;
}

export interface ComplexityResult {
  files: { file: string; loc: number; cyclomatic: number; flagged: boolean; reason?: string }[];
  summary: string;
  thresholdLoc: number;
  thresholdComplexity: number;
}

export interface A11yIssue {
  file: string;
  line: number;
  rule: string;
  message: string;
}

export interface A11yResult {
  issueCount: number;
  issues: A11yIssue[];
  summary: string;
  scannedFiles: number;
}

export interface SecretFinding {
  file: string;
  line: number;
  rule: string;
  evidence: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface SecretScanResult {
  findings: SecretFinding[];
  summary: string;
  scannedFiles: number;
}

export interface I18nGapResult {
  baseLocale: string;
  locales: { locale: string; missingKeys: string[]; extraKeys: string[] }[];
  summary: string;
}

export interface DocGapResult {
  filesMissingDoc: string[];
  foldersMissingReadme: string[];
  exportsMissingJsdoc: { file: string; symbol: string }[];
  summary: string;
}

export interface PerfBudgetResult {
  found: boolean;
  bundles: { file: string; sizeKb: number; budgetKb?: number; overBudget?: boolean }[];
  summary: string;
}

export interface MonorepoRouteResult {
  isMonorepo: boolean;
  manager?: string;
  packages: { name: string; path: string; affectedBy?: string[] }[];
  summary: string;
}

export interface ReviewPrResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
  sections: { name: string; status: "ok" | "warn" | "block"; detail: string }[];
  summary: string;
  founderBrief: string;
}

export interface FounderBriefResult {
  brief: string;
  highlights: string[];
  nextSteps: string[];
}

export interface MeetingNotesResult {
  done: string[];
  inProgress: string[];
  blockers: string[];
  notes: string;
}
