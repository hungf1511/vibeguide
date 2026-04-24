# VibeGuide — MCP Server cho AI Developer & Non-Tech Founder

[🇻🇳 Tiếng Việt](README.md) | [🇺🇸 English](README_EN.md)

VibeGuide là cầu nối giữa AI Developer (Claude Code) và Non-Tech Founder để ngăn chặn vòng lặp fix-code mãi không dứt. Nó cung cấp 34 công cụ MCP giúp AI hiểu codebase, đánh giá rủi ro, lên kế hoạch test, và đề xuất plugin Claude Code phù hợp — tất cả output bằng tiếng Việt.

## Tại sao cần VibeGuide?

Khi Founder báo "nút Thanh toán không ăn", AI Developer thường:
- Đoán mò sửa → test thất bại → sửa tiếp → lặp lại vô tận
- Không biết ảnh hưởng của thay đổi đến những chức năng nào
- Không có kế hoạch test rõ ràng để Founder xác nhận

VibeGuide giải quyết tất cả.

## 34 Tools

### Core — Hiểu codebase
- `vibeguide_scan_repo` — Quét cấu trúc repo, dependency graph
- `vibeguide_get_deps` — Trích xuất dependency graph
- `vibeguide_get_file` — Đọc file an toàn (chống path traversal)
- `vibeguide_dependency_graph` — Xuất dependency dạng Mermaid
- `vibeguide_trace_journey` — Truy vết luồng người dùng qua codebase

### Bug Detection — Tìm lỗi trước khi sửa
- `vibeguide_heuristic_bug` — Scan bug patterns (unawaited-fetch, missing-try-catch, console-log, hardcoded-secret, any-type, sql-injection, eval-usage)
- `vibeguide_bug_report` — Format bug report với severity assessment
- `vibeguide_suggest_fix` — Đề xuất fix cụ thể + giải thích tiếng Việt

### Impact Analysis — Đánh giá rủi ro
- `vibeguide_impact` — Phân tích ảnh hưởng khi sửa file
- `vibeguide_impact_confirm` — Ước tính downtime, cần approve không
- `vibeguide_regression` — Kiểm tra regression sau fix

### Planning — Lên kế hoạch
- `vibeguide_test_plan` — Generate test plan cho Founder
- `vibeguide_snapshot` — Snapshot repo trước khi sửa (create/list/restore)
- `vibeguide_deploy_check` — Pre-deploy validation (bug patterns, uncommitted changes, orphans)

### Changelog & Summary — Báo cáo cho Founder
- `vibeguide_changelog` — Generate changelog tiếng Việt từ git history
- `vibeguide_diff_summary` — Tóm tắt thay đổi code cho non-tech user
- `vibeguide_what_changed` — Xem commits/files/thay đổi gần đây

### Session Tracking — Theo dõi phiên làm việc
- `vibeguide_session_status` — Xem timeline phiên làm việc hiện tại: trạng thái, file đã sửa, snapshot backup, quyết định của Founder
- `vibeguide_export_report` — Xuất báo cáo phiên làm việc ra Markdown/JSON/Text, paste vào Notion/Linear

### Smart Routing — Gợi ý plugin Claude Code
- `vibeguide_smart_route` — Dựa vào tình huống, recommend plugin + VibeGuide tools phù hợp. Hỗ trợ tiếng Việt và tiếng Anh. Tự động scan plugin đã cài.

### Quality & Compliance — Đảm bảo chất lượng
- `vibeguide_type_check` — Chạy TypeScript type check, báo lỗi bằng tiếng Việt
- `vibeguide_test_coverage` — Đọc coverage report, liệt kê file yếu
- `vibeguide_circular_deps` — Tìm vòng lặp import
- `vibeguide_dead_code` — Tìm export không dùng và file orphan
- `vibeguide_complexity` — Phân tích độ phức tạp code (LOC + cyclomatic)
- `vibeguide_a11y_check` — Quét lỗi tiếp cận cơ bản (alt, aria-label, href, label)
- `vibeguide_secret_scan` — Quét secret, API key, credential trong source
- `vibeguide_i18n_gap` — Tìm key dịch thiếu/thừa giữa các locale
- `vibeguide_doc_gap` — Tìm file thiếu README và export thiếu JSDoc
- `vibeguide_perf_budget` — Kiểm tra kích thước bundle so với ngân sách

### Monorepo & PR — Quy mô lớn
- `vibeguide_monorepo_route` — Phát hiện monorepo manager và package bị ảnh hưởng
- `vibeguide_review_pr` — Kiểm tra pre-merge: type, bug, secret, circular deps, impact
- `vibeguide_founder_brief` — Tạo báo cáo tuần thân thiện cho Founder
- `vibeguide_meeting_notes` — Tạo biên bản họp từ session context (done, in-progress, blockers)

## Cấu hình (`.vibeguide.json`)

Tạo file `.vibeguide.json` ở root repo để tùy chỉnh:

```json
{
  "criticalFeatures": ["Thanh toán", "Giỏ hàng", "Payment", "Checkout"],
  "language": "vi",
  "outputFormat": "markdown",
  "severityThresholds": {
    "deployBlock": "critical",
    "needsApproval": "high"
  }
}
```

- `criticalFeatures` — AI sẽ cảnh báo nếu sửa file liên quan đến feature này
- `language` — Ngôn ngữ output: `"vi"` hoặc `"en"`
- `outputFormat` — Format mặc định cho report: `"json" | "markdown" | "text"`
- `severityThresholds` — Ngưỡng block deploy và cần Founder approve

## GitHub Action

VibeGuide tự động chạy CI trên mỗi PR (`.github/workflows/vibeguide-check.yml`):

```yaml
name: VibeGuide Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - run: npm run check
      - run: node test-mcp.cjs
```

## Cài đặt

```bash
git clone https://github.com/hungf1511/vibeguide.git
cd vibeguide
npm install
npm run build
npm run check  # VibeGuide tự quét chính nó — dogfooding
```

## Kết nối với Claude Code

Thêm vào `~/.mcp.json` (hoặc `.mcp.json` trong project):

```json
{
  "mcpServers": {
    "vibeguide": {
      "command": "node",
      "args": ["/path/to/vibeguide/dist/mcp/server.js"]
    }
  }
}
```

Sau đó trong Claude Code gõ `/mcp` để kết nối.

## Kiểm thử

```bash
node test-mcp.cjs          # 45 assertions — tất cả tools
node test-scenario.cjs     # Scenario thực tế (payment button)
node test-future-tools.cjs # Snapshot, diff summary, deploy check
node test-batch2.cjs       # Suggest fix, changelog, dependency graph
npm run check              # VibeGuide self-check (dogfooding)
```

## Workflow thực tế

```
Founder: "Nút Thanh toán không ăn"
        ↓
[Dev] vibeguide_smart_route → detect bug + recommend tools
[Dev] vibeguide_heuristic_bug → tìm 2 bug patterns
[Dev] vibeguide_trace_journey → truy vết luồng payment
[Dev] vibeguide_impact → đánh giá rủi ro medium
[Dev] vibeguide_impact_confirm → Founder cần approve 1 ngày downtime
[Dev] vibeguide_test_plan → 6 bước test cho Founder
[Dev] vibeguide_snapshot → backup trước khi sửa
[Founder test → Pass]
[Dev] vibeguide_session_status → Founder xem tổng kết phiên làm việc
[Dev] vibeguide_deploy_check → kiểm tra trước deploy
[Deploy thành công]
```

## Công nghệ

- TypeScript + ESM
- MCP SDK (@modelcontextprotocol/sdk)
- Zod schemas
- No database — JSON file cache + JSON session tracking
- SHA-256 snapshots
- Dogfooding: `npm run check` tự quét chính nó bằng VibeGuide

## License

MIT
