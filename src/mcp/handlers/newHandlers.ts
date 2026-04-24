/** Barrel re-export — kept for backward compatibility. Prefer importing from specific modules. */
export {
  handleTypeCheck,
  handleTestCoverage,
  handleComplexity,
  handleA11yCheck,
  handleDocGap,
  handlePerfBudget,
} from "./quality.js";
export {
  handleCircularDeps,
  handleDeadCode,
  handleSecretScanV2,
  handleI18nGap,
} from "./analysis.js";
export {
  handleMonorepoRoute,
} from "./monorepo.js";
export {
  handleReviewPr,
} from "./review.js";
export {
  handleFounderBrief,
  handleMeetingNotes,
} from "./briefing.js";
