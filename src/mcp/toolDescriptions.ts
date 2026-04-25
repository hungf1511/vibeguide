/** Bilingual MCP tool descriptions. */

const descriptions: Record<string, string> = {
  vibeguide_impact: "Analyze impact of changing a file â€” PhÃ¢n tÃ­ch áº£nh hÆ°á»Ÿng khi thay Ä‘á»•i file: affected files, risk level, UI components.",
  vibeguide_trace_journey: "Trace user journey â€” Theo dÃµi hÃ nh trÃ¬nh ngÆ°á»i dÃ¹ng: entry points, files involved.",
  vibeguide_heuristic_bug: "Find bug patterns â€” TÃ¬m lá»—i theo mÃ´ táº£ triá»‡u chá»©ng.",
  vibeguide_regression: "Check regression â€” Kiá»ƒm tra há»“i quy sau thay Ä‘á»•i: affected flows, test coverage.",
  vibeguide_scan_repo: "Scan repository â€” QuÃ©t cáº¥u trÃºc vÃ  dependency cá»§a repo.",
  vibeguide_test_plan: "Generate test plan â€” Táº¡o ká»‹ch báº£n kiá»ƒm thá»­ cho tÃ­nh nÄƒng.",
  vibeguide_bug_report: "Format bug report â€” Äá»‹nh dáº¡ng bÃ¡o cÃ¡o lá»—i vá»›i má»©c Ä‘á»™ nghiÃªm trá»ng.",
  vibeguide_impact_confirm: "Confirm impact â€” XÃ¡c nháº­n áº£nh hÆ°á»Ÿng trÆ°á»›c khi sá»­a: features, downtime.",
  vibeguide_what_changed: "Show recent changes â€” Hiá»ƒn thá»‹ thay Ä‘á»•i gáº§n Ä‘Ã¢y: commits, files, features.",
  vibeguide_get_file: "Read file â€” Äá»c ná»™i dung file an toÃ n (chá»‘ng path traversal).",
  vibeguide_get_deps: "Get dependency graph â€” Láº¥y Ä‘á»“ thá»‹ phá»¥ thuá»™c cá»§a repo.",
  vibeguide_snapshot: "Snapshot â€” Chá»¥p, liá»‡t kÃª, hoáº·c khÃ´i phá»¥c snapshot trÆ°á»›c/sau thay Ä‘á»•i.",
  vibeguide_diff_summary: "Diff summary â€” TÃ³m táº¯t thay Ä‘á»•i code báº±ng tiáº¿ng Viá»‡t cho non-tech.",
  vibeguide_deploy_check: "Deploy check â€” Kiá»ƒm tra trÆ°á»›c deploy: bug, uncommitted, orphan files.",
  vibeguide_suggest_fix: "Suggest fix â€” Gá»£i Ã½ sá»­a code cá»¥ thá»ƒ cho bug patterns.",
  vibeguide_changelog: "Changelog â€” Táº¡o changelog tiáº¿ng Viá»‡t tá»« lá»‹ch sá»­ git.",
  vibeguide_dependency_graph: "Dependency graph â€” Xuáº¥t Ä‘á»“ thá»‹ phá»¥ thuá»™c dáº¡ng Mermaid hoáº·c JSON.",
  vibeguide_language_support: "Language support â€” Liá»‡t kÃª analyzer active cho JavaScript, TypeScript, Python, Go, Rust.",
  vibeguide_smart_route: "Smart route â€” Äá»‹nh tuyáº¿n thÃ´ng minh: phÃ¡t hiá»‡n tÃ¬nh huá»‘ng, gá»£i Ã½ plugin/tool.",
  vibeguide_export_report: "Export report â€” Xuáº¥t timeline session dáº¡ng Markdown, JSON, hoáº·c text.",
  vibeguide_type_check: "Type check â€” Cháº¡y kiá»ƒm tra TypeScript vÃ  bÃ¡o lá»—i báº±ng tiáº¿ng Viá»‡t.",
  vibeguide_test_coverage: "Test coverage â€” Äá»c bÃ¡o cÃ¡o Ä‘á»™ phá»§ test vÃ  liá»‡t kÃª file yáº¿u.",
  vibeguide_circular_deps: "Circular deps â€” TÃ¬m vÃ²ng láº·p import trong Ä‘á»“ thá»‹ phá»¥ thuá»™c.",
  vibeguide_dead_code: "Dead code â€” TÃ¬m export khÃ´ng dÃ¹ng vÃ  file orphan.",
  vibeguide_complexity: "Complexity â€” PhÃ¢n tÃ­ch Ä‘á»™ phá»©c táº¡p code (LOC + cyclomatic).",
  vibeguide_a11y_check: "Accessibility â€” QuÃ©t lá»—i tiáº¿p cáº­n cÆ¡ báº£n: alt, aria-label, href, label.",
  vibeguide_secret_scan: "Secret scan â€” QuÃ©t secret, API key, credential trong source.",
  vibeguide_i18n_gap: "i18n gap â€” TÃ¬m key dá»‹ch thiáº¿u/thá»«a giá»¯a cÃ¡c locale.",
  vibeguide_doc_gap: "Doc gap â€” TÃ¬m file thiáº¿u README vÃ  export thiáº¿u JSDoc.",
  vibeguide_perf_budget: "Perf budget â€” Kiá»ƒm tra kÃ­ch thÆ°á»›c bundle so vá»›i ngÃ¢n sÃ¡ch performance.",
  vibeguide_monorepo_route: "Monorepo â€” PhÃ¡t hiá»‡n monorepo manager vÃ  liá»‡t kÃª package bá»‹ áº£nh hÆ°á»Ÿng.",
  vibeguide_review_pr: "Review PR â€” Kiá»ƒm tra pre-merge: type, bug, secret, circular deps, impact.",
  vibeguide_founder_brief: "Founder brief â€” Táº¡o bÃ¡o cÃ¡o tuáº§n thÃ¢n thiá»‡n cho founder.",
  vibeguide_meeting_notes: "Meeting notes â€” Táº¡o biÃªn báº£n há»p tá»« session context (done, in-progress, blockers).",
  vibeguide_git_status: "Git status â€” Tráº¡ng thÃ¡i git: branch, SHA, sáº¡ch/dirty, sá»‘ file chÆ°a commit.",
  vibeguide_git_log: "Git log â€” Lá»‹ch sá»­ commit cÃ³ cáº¥u trÃºc: SHA, author, date, message, files changed.",
  vibeguide_index_build: "Index build — Xây dựng hoặc rebuild SQLite index cho repo để tăng tốc query.",
  vibeguide_index_status: "Index status — Kiểm tra trạng thái index: tồn tại, số file, freshness, kích thước.",
  vibeguide_index_clear: "Index clear — Xóa database index của repo.",
};

/** Return human-readable description for a tool name. */
export function getToolDescription(name: string): string {
  return descriptions[name] || "";
}
