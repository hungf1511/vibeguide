# VibeGuide — MCP Server cho AI Developer & Founder không chuyên kỹ thuật

[Tiếng Việt](README.md) | [English](README_EN.md)

VibeGuide là MCP server giúp AI coding assistant như Codex hoặc Claude Code hiểu codebase trước khi sửa. Thay vì đoán mò, AI có thể quét repo, tìm bug pattern, phân tích ảnh hưởng, tạo snapshot, kiểm tra trước deploy và viết báo cáo dễ hiểu cho người không chuyên kỹ thuật.

Dự án hiện có 34 MCP tools, viết bằng TypeScript, chạy local, không cần database.

## Vấn đề VibeGuide giải quyết

Khi Founder nói "nút Thanh toán không ăn", AI Developer thường gặp 3 rủi ro:

- Sửa theo phỏng đoán, test fail rồi tiếp tục sửa vòng lặp.
- Không biết thay đổi một file sẽ ảnh hưởng đến feature nào.
- Không có test plan rõ ràng để Founder xác nhận trước khi deploy.

VibeGuide biến tình huống mơ hồ thành workflow rõ ràng: scan → trace → impact → snapshot → fix → review → deploy check.

## Cài đặt nhanh

```bash
git clone https://github.com/hungf1511/vibeguide.git
cd vibeguide
npm install
npm run build
npm run check
```

Chạy MCP server:

```bash
npm run start
```

## Kết nối với Codex

Thêm server vào `C:\Users\User\.codex\config.toml` hoặc file config Codex tương ứng:

```toml
[mcp_servers.vibeguide]
command = "node"
args = ["C:/Users/User/vibeguide/dist/mcp/server.js"]
```

Kiểm tra:

```bash
codex mcp list
codex mcp get vibeguide
```

Sau khi reload Codex, các tool `vibeguide_*` sẽ xuất hiện trong phiên làm việc mới.

## Kết nối với Claude Code

Thêm vào `~/.mcp.json` hoặc `.mcp.json` trong project:

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

Sau đó mở Claude Code và dùng `/mcp` để kiểm tra kết nối.

## 34 Tools

### Core — Hiểu codebase

- `vibeguide_scan_repo` — Quét cấu trúc repo và dependency graph.
- `vibeguide_get_deps` — Lấy dependency graph đã scan.
- `vibeguide_get_file` — Đọc file an toàn, chống path traversal.
- `vibeguide_dependency_graph` — Xuất dependency graph dạng Mermaid hoặc JSON.
- `vibeguide_trace_journey` — Truy vết hành trình người dùng qua các file liên quan.

### Bug Detection — Tìm lỗi trước khi sửa

- `vibeguide_heuristic_bug` — Tìm bug pattern như unawaited fetch, missing try/catch, secret hardcode, SQL injection, `eval`.
- `vibeguide_bug_report` — Chuẩn hóa bug report theo severity.
- `vibeguide_suggest_fix` — Gợi ý fix cụ thể cho bug pattern.

### Impact Analysis — Đánh giá rủi ro

- `vibeguide_impact` — Phân tích file bị ảnh hưởng khi sửa một file.
- `vibeguide_impact_confirm` — Ước tính feature bị ảnh hưởng, downtime và mức cần approval.
- `vibeguide_regression` — Kiểm tra regression sau thay đổi.

### Planning — Lập kế hoạch

- `vibeguide_test_plan` — Tạo test plan cho một feature.
- `vibeguide_snapshot` — Tạo, liệt kê hoặc restore snapshot trước khi sửa.
- `vibeguide_deploy_check` — Kiểm tra bug pattern, uncommitted changes và orphan files trước deploy.

### Changelog & Summary — Báo cáo dễ hiểu

- `vibeguide_changelog` — Tạo changelog tiếng Việt từ git history.
- `vibeguide_diff_summary` — Tóm tắt diff hiện tại cho non-tech user.
- `vibeguide_what_changed` — Xem commit, file và thay đổi gần đây.

### Session Tracking — Theo dõi phiên làm việc

- `vibeguide_session_status` — Xem trạng thái phiên hiện tại, file đã sửa, snapshot và quyết định.
- `vibeguide_export_report` — Xuất timeline phiên làm việc dạng Markdown, JSON hoặc text.

### Smart Routing — Gợi ý tool phù hợp

- `vibeguide_smart_route` — Nhận mô tả tình huống rồi đề xuất tool/plugin nên dùng tiếp theo.

### Quality & Compliance — Kiểm tra chất lượng

- `vibeguide_type_check` — Chạy TypeScript check và báo lỗi dễ hiểu.
- `vibeguide_test_coverage` — Đọc coverage report và liệt kê file yếu.
- `vibeguide_circular_deps` — Tìm vòng lặp import.
- `vibeguide_dead_code` — Tìm export không dùng và file orphan.
- `vibeguide_complexity` — Phân tích LOC và cyclomatic complexity.
- `vibeguide_a11y_check` — Quét lỗi accessibility cơ bản.
- `vibeguide_secret_scan` — Quét secret, API key, credential.
- `vibeguide_i18n_gap` — Tìm key dịch thiếu hoặc thừa giữa locale.
- `vibeguide_doc_gap` — Tìm file thiếu README và export thiếu JSDoc.
- `vibeguide_perf_budget` — Kiểm tra kích thước bundle theo performance budget.

### Monorepo & PR — Kiểm tra trước merge

- `vibeguide_monorepo_route` — Phát hiện monorepo manager và package bị ảnh hưởng.
- `vibeguide_review_pr` — Kiểm tra pre-merge: type, bug, secret, circular deps, impact.
- `vibeguide_founder_brief` — Tạo báo cáo tuần thân thiện cho Founder.
- `vibeguide_meeting_notes` — Tạo meeting notes từ session context.

## Cấu hình `.vibeguide.json`

Ví dụ:

```json
{
  "framework": "auto",
  "ignorePatterns": [
    "*.test.ts",
    "*.spec.ts",
    "__tests__/**",
    "*.d.ts",
    "test-project/**",
    "test-*.cjs",
    "scripts/**"
  ],
  "thresholds": {
    "bugPatterns": {
      "critical": 0,
      "high": 3,
      "medium": 10
    },
    "orphanFiles": 10,
    "contextBudget": 4000
  },
  "security": {
    "scanDependencies": true,
    "owaspTop10": true
  }
}
```

Các trường quan trọng:

- `ignorePatterns` giúp loại test fixture, script hoặc file sinh ra khỏi scan.
- `thresholds` điều chỉnh mức cảnh báo cho bug pattern, orphan file và context budget.
- `security` bật/tắt các kiểm tra bảo mật.
- `framework` để `auto` nếu muốn VibeGuide tự nhận diện project.

## Kiểm thử

```bash
npm run build
npm run check
node test-mcp.cjs
node test-scenario.cjs
node test-future-tools.cjs
node test-batch2.cjs
```

Bộ test hiện kiểm tra:

- MCP server expose đủ 34 tools.
- `test-mcp.cjs` hiện có 60 assertion cho tool list, schema, analyzer và smart routing.
- Zod schema chuyển sang JSON Schema đúng enum/default/literal/nested object.
- Tool registry được tách khỏi schema/description/output compression để giảm complexity.
- `vibeguide_dead_code` tránh false-positive từ comment, type-only usage và text trong re-export.
- `vibeguide_complexity` dùng max function complexity, bỏ qua file type-only/static data dài.
- Snapshot restore khôi phục file bị sửa và xóa file mới tạo sau snapshot.
- Diff summary, deploy check, changelog, dependency graph và suggest fix.
- TypeScript check chạy qua compiler local khi có `node_modules/typescript`.

## Dogfooding

VibeGuide được dùng để kiểm tra chính VibeGuide. Một vòng self-test nên gồm:

```bash
vibeguide_scan_repo
vibeguide_type_check
vibeguide_diff_summary
vibeguide_review_pr
vibeguide_deploy_check
```

Kết quả mong muốn trước khi commit:

- `vibeguide_type_check` pass.
- `vibeguide_review_pr` không có blocker.
- `vibeguide_dead_code` không báo export chết ngoài các API public có chủ đích.
- `vibeguide_complexity` tập trung vào logic phức tạp, không flag dữ liệu tĩnh hoặc type-only file.
- `vibeguide_deploy_check` chỉ được warning nếu còn uncommitted changes.

## Kiến trúc nội bộ

VibeGuide giữ MCP surface ổn định ở `src/mcp/tools.ts`, nhưng tách phần phụ trợ thành module nhỏ:

- `src/mcp/toolSchemas.ts` — Zod schemas cho 34 tools.
- `src/mcp/toolDescriptions.ts` — mô tả song ngữ cho tool list.
- `src/mcp/toolOutput.ts` — nén output để giữ context budget.
- `src/mcp/zodJsonSchema.ts` — chuyển Zod schema sang JSON Schema cho MCP.
- `src/utils/codeText.ts` — strip comment/string/regex trước khi analyzer đọc code.

Mục tiêu là để `tools.ts` chỉ làm orchestration: register tools, validate input, gọi handler, log session và trả output.

## Workflow thực tế

```text
Founder: "Nút Thanh toán không ăn"
        ↓
vibeguide_smart_route
        ↓
vibeguide_heuristic_bug
        ↓
vibeguide_trace_journey
        ↓
vibeguide_impact + vibeguide_impact_confirm
        ↓
vibeguide_test_plan + vibeguide_snapshot
        ↓
Fix code
        ↓
vibeguide_review_pr + vibeguide_deploy_check
        ↓
Deploy
```

## GitHub Action

VibeGuide có thể chạy CI trên push/PR:

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
      - run: node test-future-tools.cjs
```

## Tech Stack

- TypeScript + ESM.
- MCP SDK `@modelcontextprotocol/sdk`.
- Zod schema cho tool input.
- MCP registry tách schema, description, output compression và Zod JSON Schema conversion.
- JSON cache/session/snapshot, không cần database.
- SHA-256 checksum cho snapshot.
- Dogfooding bằng chính MCP tools của VibeGuide.

## License

MIT
