# VibeGuide — MCP Server cho AI Developer & Non-Tech Founder

[🇻🇳 Tiếng Việt](README.md) | [🇺🇸 English](README_EN.md)

VibeGuide là cầu nối giữa AI Developer (Claude Code) và Non-Tech Founder để ngăn chặn vòng lặp fix-code mãi không dứt. Nó cung cấp 19 công cụ MCP giúp AI hiểu codebase, đánh giá rủi ro, lên kế hoạch test, và đề xuất plugin Claude Code phù hợp — tất cả output bằng tiếng Việt.

## Tại sao cần VibeGuide?

Khi Founder báo "nút Thanh toán không ăn", AI Developer thường:
- Đoán mò sửa → test thất bại → sửa tiếp → lặp lại vô tận
- Không biết ảnh hưởng của thay đổi đến những chức năng nào
- Không có kế hoạch test rõ ràng để Founder xác nhận

VibeGuide giải quyết tất cả.

## 19 Tools

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

### Smart Routing — Gợi ý plugin Claude Code
- `vibeguide_smart_route` — Dựa vào tình huống, recommend plugin + VibeGuide tools phù hợp. Hỗ trợ tiếng Việt và tiếng Anh. Tự động scan plugin đã cài.

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
node test-mcp.cjs          # 39 assertions — tất cả tools
node test-scenario.cjs     # Scenario thực tế (payment button)
node test-future-tools.cjs # Snapshot, diff summary, deploy check
node test-batch2.cjs       # Suggest fix, changelog, dependency graph
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
