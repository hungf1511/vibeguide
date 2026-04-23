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
  severity: "info" | "warning" | "critical";
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
