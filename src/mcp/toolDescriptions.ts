/** Bilingual MCP tool descriptions. */

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

export function getToolDescription(name: string): string {
  return descriptions[name] || "";
}
