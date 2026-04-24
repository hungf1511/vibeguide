// Barrel re-exports for backward compatibility
export {
  handleImpact,
  handleImpactConfirm,
  handleRegression,
} from "./impact.js";
export {
  handleScanRepo,
  handleGetFile,
  handleGetDeps,
  handleWhatChanged,
  handleChangelog,
  handleDepGraph,
  handleSnapshot,
  handleDiffSummary,
} from "./repo.js";
export {
  handleTraceJourney,
  handleHeuristicBug,
  handleTestPlan,
  handleBugReport,
  handleSuggestFix,
} from "./bug.js";
export {
  handleDeployCheck,
} from "./deploy.js";
export {
  handleSmartRoute,
  handleSessionStatus,
  handleExportReport,
} from "./session.js";
