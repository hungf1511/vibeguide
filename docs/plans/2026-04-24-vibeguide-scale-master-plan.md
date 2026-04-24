# VibeGuide 2.0 — Master Plan: Scale to the Limit

**Ngày viết:** 2026-04-24
**Tác giả:** Claude (Opus 4.7) + hungf1511
**Phương pháp:** Dogfooded — plan này được survey bằng chính VibeGuide (`scan_repo`, `complexity`, `circular_deps`, `dead_code`, `doc_gap`, `founder_brief`, `session_status`) trên repo của chính nó trước khi viết.
**Mục tiêu:** Biến VibeGuide từ "great for small projects" thành "git-native, polyglot, federatable, founder-facing platform" xử lý được monorepo + multi-repo + long-lived + multi-stack projects, mà không đánh mất DNA hiện tại (local, zero-config, founder-friendly).

---

## 0. TL;DR

VibeGuide 1.0 có 34 tools tốt cho dự án nhỏ. Bottleneck khi scale nằm ở 4 trục: **monorepo (B)**, **multi-repo (C)**, **lịch sử dài (D)**, **đa ngôn ngữ (F)**.

Thay vì tự xây DB/index nặng, plan này dùng đòn bẩy **"thứ đã có sẵn"**:

1. **Git = index miễn phí** → giải D gần hết, tăng tốc tất cả tool
2. **Tree-sitter = parser đúng** → giải F (import parse JS-only hiện tại là **sai lặng lẽ**)
3. **GitNexus bridge** = federation → giải C mà không phải reimplement graph DB
4. **Workspace manifest** → hợp nhất B + C dưới 1 khái niệm
5. **Streaming output + scope-first** → giải blowup context window khi repo to
6. **Optional SQLite index** (opt-in, không bắt buộc) → incremental cho repo khổng lồ
7. **Platform layer** (CLI, GitHub Action, dashboard) → mở rộng surface ngoài MCP
8. **Intelligence loop** → học từ feedback để heuristic ngày càng chính xác

11 phase, ước tính **24-26 tuần** (có thể parallelize xuống ~18 tuần với 2-3 contributor).

Kết thúc: VibeGuide 2.0 handle được **1M LOC polyglot monorepo trải 10 repo qua 3 năm lịch sử** mà vẫn zero-config cho project nhỏ.

---

## 1. Current State Assessment (từ dogfood)

### 1.1 Con số thô

| Chỉ số | Giá trị | Nhận xét |
|---|---|---|
| Tổng file | 49 (44 TS) | Nhỏ gọn |
| Tool MCP | 34 | Nhiều, cần gom nhóm |
| Import cycles | 0 | Kiến trúc sạch |
| Dead code | 0 export, 0 file | Clean |
| Test coverage | **Không có** | **Gap nghiêm trọng** |
| Doc gap | 80 exports thiếu JSDoc, 4 folder thiếu README | Cần cải thiện |
| File complexity ≥ 15 cyclomatic | 7 file | **Hotspot để refactor** |

### 1.2 Complexity hotspots (ưu tiên refactor)

| File | LOC | Cyclomatic | Ghi chú |
|---|---|---|---|
| `src/mcp/handlers/deploy.ts` | 95 | **31** | Nhiều check lồng if/else |
| `src/mcp/handlers/repo.ts` | 191 | 25 | Nhiều path branching |
| `src/mcp/handlers/newHandlers.ts` | 224 | 24 | **Dispatcher bloat** — 14 handler chung 1 file |
| `src/mcp/handlers/bug.ts` | 147 | 20 | |
| `src/utils/deadCode.ts` | 104 | 19 | |
| `src/utils/fixSuggestions.ts` | 87 | 18 | |
| `src/utils/a11y.ts` | 45 | 16 | Nhỏ nhưng dense |

### 1.3 Kiến trúc hiện tại

```
src/
  mcp/
    server.ts           # stdio transport + dispatch
    tools.ts            # 34 handler registry (1 Record lớn)
    toolSchemas.ts      # Zod schemas
    toolDescriptions.ts # bilingual descriptions
    toolOutput.ts       # compressOutput (post-hoc)
    zodJsonSchema.ts
    handlers/
      bug.ts            # 6 handlers
      deploy.ts         # 1 handler, rất dày
      impact.ts         # 4 handlers
      repo.ts           # 5 handlers
      session.ts
      newHandlers.ts    # 14 handlers gom vào đây ← smell
      handlers.ts       # delegator cũ
      index.ts
  utils/
    scanner.ts          # fs walk + regex imports (JS-only!)
    cache.ts            # JSON file, signature = fileCount + totalMtime
    snapshot.ts         # **full file content** vào JSON (không scale)
    monorepo.ts         # package.json-based
    sessionContext.ts   # ~/.vibeguide/session/*.json, events array unbounded
    ... (27 util modules)
  types.ts              # All interfaces
```

### 1.4 Bottleneck cụ thể phát hiện qua đọc code

**BN1. Import parser JS-only (scanner.ts:118)**
Regex cho `import ... from`, `require(...)`, `export ... from` chỉ match syntax JS/TS. File `.py`/`.go`/`.rs` được list nhưng edges build từ regex → **sai lặng lẽ**, chưa có test nào detect.

**BN2. Cache signature yếu (scanner.ts:43-53)**
`getRepoSignature` = `fileCount + Σmtime`. Đổi 1 file → invalidate toàn repo. Checkout branch khác, mtime thay đổi, cache invalidate dù content giống.

**BN3. Snapshot lưu full content (snapshot.ts:62-91)**
Mỗi snapshot = JSON chứa **toàn bộ file content**. Repo 10MB source = snapshot 10MB. Không incremental, không delta. Không scale past ~50MB source.

**BN4. Session context unbounded (sessionContext.ts:67)**
`ctx.events.push(event)` không bao giờ trim. Session dài = file JSON to dần.

**BN5. `compressOutput` post-hoc (tools.ts:119-126)**
Handler build full JSON → estimate token → compress nếu quá. Nghĩa là **đã build xong rồi mới cắt** — memory và CPU đã tiêu. Tools không có way request "summary-only".

**BN6. `newHandlers.ts` dispatcher bloat (224 LOC, cyclomatic 24)**
14 handler cho tools khác biệt gom vào 1 file vì convention "new tools go here". Smell rõ.

**BN7. `process.cwd()` coupling (snapshot.ts:7, cache.ts:5)**
Dir cache/snapshot đặt tại `process.cwd()`. stdio MCP server có thể được spawn từ bất kỳ cwd nào → path cache không predictable. Nên ở `~/.vibeguide/` hoặc `<repo>/.vibeguide/`.

**BN8. Không có test, không có benchmark, không có CI**
`package.json` chỉ có `build`/`dev`/`start`/`check`. Test coverage = 0. Mọi refactor là hứng chịu regression.

**BN9. Không có khái niệm "scope"**
Mọi tool nhận `repoPath` rồi scan toàn bộ. Không thể nói "chỉ phân tích `apps/web`" hoặc "chỉ file đổi từ `HEAD~10`".

**BN10. Không có khái niệm workspace/multi-repo**
Tool chạy trên 1 repo. Microservices không có chỗ đứng.

---

## 2. Design Principles

Các phase sau **bắt buộc** tuân thủ:

**P1. Lean on existing tools, don't reimplement**
Git, tree-sitter, simple-git, MCP SDK đã tốt. VibeGuide là orchestration + heuristic layer, không phải infrastructure.

**P2. Stateless by default, index only when needed**
Mặc định vẫn compute từ đầu để zero-config. Index là opt-in cho user advanced.

**P3. Scope-first**
Mỗi tool chấp nhận `scope: { package?, path?, since?, languages? }`. Full-repo chỉ là default, không phải ép buộc.

**P4. Output là data có cấu trúc, không phải string đã format**
Mỗi tool return cả `data` (machine-readable) và `report` (human-readable) tách biệt. Compression chỉ trên data.

**P5. Composition over reimplementation**
Có GitNexus → federate. Có LSP → dùng. Có git → delegate. Không tự xây lại.

**P6. Progressive complexity**
Beginner không thấy `workspace.yaml`. Advanced mở ra khi cần. Flag `--advanced` hoặc env var bật unlock.

**P7. Human-in-the-loop là first-class**
Mọi tool quan trọng expose `dryRun` + `needsApproval` + `rollback`. Founder luôn có thể xem rồi quyết.

**P8. Dogfood mỗi phase**
Kết thúc mỗi phase: VibeGuide tự phân tích chính nó. Nếu tool mới không giải quyết được pain của chính repo VibeGuide → phase chưa done.

**P9. Breaking change có migration**
Bump version nghiêm túc. v1 tools được deprecated 2 minor versions trước khi xóa.

**P10. i18n từ gốc**
Mọi string human-readable đi qua `i18n.ts`. VN + EN từ đầu (match target user).

---

## 3. Target Architecture

### 3.1 Layered model

```
┌─────────────────────────────────────────────────┐
│ Transport:  MCP stdio │ CLI │ HTTP/SSE │ WebUI  │  Layer 6
├─────────────────────────────────────────────────┤
│ Reports:    Founder / Dev / CI / Slack          │  Layer 5
├─────────────────────────────────────────────────┤
│ Tools:      34+ MCP tools (thin wrappers)       │  Layer 4
├─────────────────────────────────────────────────┤
│ Queries:    impact, trace, ownership, contract  │  Layer 3
├─────────────────────────────────────────────────┤
│ Index:      SQLite (opt-in) │ In-memory cache   │  Layer 2
├─────────────────────────────────────────────────┤
│ Analyzers:  TS/JS, Python, Go, Rust, Java...    │  Layer 1
├─────────────────────────────────────────────────┤
│ Sources:    Git │ Filesystem │ Tree-sitter │ LSP│  Layer 0
└─────────────────────────────────────────────────┘
```

**Rule vàng:** Layer trên chỉ gọi layer dưới, không bao giờ ngược. Tools (L4) không được đọc file trực tiếp — phải qua Queries (L3).

### 3.2 Concept mới

**Scope** — unit cơ bản của mọi operation:
```ts
interface Scope {
  repo: string;
  package?: string;
  paths?: string[];
  since?: string;
  until?: string;
  languages?: Language[];
  includeTests?: boolean;
  maxDepth?: number;
}
```

**Workspace** — collection of repos (multi-repo):
```yaml
# vibeguide.workspace.yaml
name: acme-platform
repos:
  web:
    path: ./web
    language: ts
  api:
    path: ../api-service
    language: go
  mobile:
    path: ../mobile-app
    language: dart
contracts:
  - from: web
    to: api
    type: openapi
    spec: ../api-service/openapi.yaml
  - from: mobile
    to: api
    type: grpc
    spec: ../api-service/proto/
```

**Contract** — typed cross-boundary dependency:
```ts
interface Contract {
  from: WorkspaceRepo;
  to: WorkspaceRepo;
  kind: "openapi" | "grpc" | "graphql" | "event" | "db-schema" | "shared-lib";
  endpoints: ContractEndpoint[];
}
```

**Signal** — atomic AI-actionable finding:
```ts
interface Signal {
  id: string;
  kind: "bug" | "perf" | "a11y" | "i18n" | "sec" | "dead" | "contract-break";
  severity: "info" | "warn" | "high" | "critical";
  where: { file: string; line?: number; scope?: Scope };
  what: string;
  why?: string;
  fix?: { file: string; line: number; before: string; after: string }[];
  confidence: number;
  source: string;
}
```

**Budget** — context/time awareness:
```ts
interface Budget {
  tokens?: number;
  ms?: number;
  depth?: "summary" | "normal" | "deep";
}
```

### 3.3 Target file layout (v2.0)

```
src/
  core/
    git/
      index.ts
      ls-files.ts
      blame.ts
      log.ts
      diff.ts
    scope.ts
    workspace.ts
    contract.ts
    budget.ts
    i18n.ts
    logger.ts
    types.ts

  analyzers/
    spi.ts
    registry.ts
    javascript/
      index.ts
      imports.ts
      exports.ts
      frameworks.ts
    python/
      index.ts
      ast.ts
    go/
      index.ts
    rust/
      index.ts
    java/
    csharp/

  index/
    store.ts
    schema.sql
    migrations/
    graph.ts
    history.ts
    ownership.ts
    embeddings.ts

  queries/
    impact.ts
    trace.ts
    circular.ts
    dead.ts
    complexity.ts
    contract.ts
    ownership.ts
    churn.ts

  tools/
    scan/
      scanRepo.ts
    impact/
      impact.ts
      impactConfirm.ts
      regression.ts
    bug/
      heuristicBug.ts
      suggestFix.ts
      bugReport.ts
    quality/
      typeCheck.ts
      testCoverage.ts
      deadCode.ts
      complexity.ts
      circularDeps.ts
      a11y.ts
      i18nGap.ts
      docGap.ts
      perfBudget.ts
      secretScan.ts
    workflow/
      smartRoute.ts
      testPlan.ts
      traceJourney.ts
    repo/
      getFile.ts
      getDeps.ts
      dependencyGraph.ts
      whatChanged.ts
      changelog.ts
      diffSummary.ts
      snapshot.ts
    workspace/
      workspaceInit.ts
      workspaceScan.ts
      workspaceImpact.ts
      contractCheck.ts
    review/
      reviewPr.ts
      deployCheck.ts
    report/
      founderBrief.ts
      meetingNotes.ts
      exportReport.ts
      sessionStatus.ts
    history/
      ownership.ts
      churn.ts
      retrospective.ts

  reports/
    founder.ts
    developer.ts
    ci.ts
    slack.ts

  bridges/
    gitnexus.ts
    github.ts
    slack.ts
    lsp.ts

  transport/
    mcp/
      server.ts
      dispatch.ts
      streaming.ts
    cli/
      index.ts
      commands/
    http/
      server.ts
      sse.ts
    dashboard/
      server.ts
      static/

  plugins/
    loader.ts
    sandbox.ts
    registry.ts
```

---

## 4. Phased Roadmap

Timeline giả định 1 maintainer full-time. Mỗi phase độc lập đủ để ship + dùng; plan không bị "nghẽn" nếu dừng giữa chừng.

### PHASE 0 — Foundation Hygiene (Tuần 1-2)

**Mục tiêu:** Dọn nền, có test, có CI, có benchmark. Không làm feature mới.

**Deliverables:**

- [ ] Setup vitest + coverage (v8 provider)
- [ ] Config `.github/workflows/ci.yml`: lint, build, test, dogfood trên self
- [ ] Chuyển `test-*.cjs` files về `tests/` với vitest
- [ ] Viết unit test cho 5 util quan trọng: scanner, cache, pathGuard, monorepo, snapshot (target ≥70% coverage)
- [ ] Setup benchmark harness (tinybench) với 3 fixture repo: `fixtures/small/`, `fixtures/medium/`, `fixtures/monorepo/`
- [ ] Tách `newHandlers.ts` thành per-tool file trong `src/mcp/handlers/` theo nhóm chức năng
- [ ] Viết `docs/architecture.md` vẽ kiến trúc hiện tại (as-is diagram)
- [ ] Viết `docs/contributing.md` setup dev loop
- [ ] Dogfood script: `npm run check:self` chạy vibeguide trên vibeguide, output checklist
- [ ] Release `v1.1.0` với CI, test, docs (không breaking change)

**Exit criteria:**
- `npm test` pass ≥70% coverage
- CI xanh trên PR
- `newHandlers.ts` < 50 LOC (chỉ re-export)
- Benchmark baseline saved cho scan_repo, impact, trace_journey

**Risk:** Người dùng hiện tại của VibeGuide nếu có fork / edit local có thể bị xung đột khi split `newHandlers.ts`. Mitigate: giữ `newHandlers.ts` như barrel re-export cho 2 minor versions.

---

### PHASE 1 — Git-Native Scanner (Tuần 3-4)

**Mục tiêu:** Git trở thành nguồn dữ liệu chính. Giải **trục D** phần lớn. Tăng tốc toàn bộ.

**Deliverables:**

- [ ] Module `src/core/git/`: `ls-files.ts`, `blame.ts`, `log.ts`, `diff.ts`, `head.ts`
- [ ] `scanner.ts::getAllSourceFiles` — dùng `git ls-files -co --exclude-standard`, fallback fs walk nếu không phải git repo
- [ ] Cache signature đổi: `getRepoSignature = git rev-parse HEAD` + `git status --porcelain` hash → content-addressed, đổi branch không invalidate sai
- [ ] Thêm `scope.since` / `scope.until` dùng `git log --since= --name-only`
- [ ] Rewrite `getRecentCommits` dùng native git thay vì reflog fallback
- [ ] Thêm tool `vibeguide_git_status` (native) + `vibeguide_git_log`
- [ ] Đổi `changelog.ts` sang dùng real git log thay vì ad-hoc heuristic
- [ ] Benchmark: scan_repo trên fixture 10k-file phải nhanh ≥5× baseline

**Exit criteria:**
- Tất cả tools hiện tại vẫn pass test
- Cache hit rate ≥90% sau 2 lần gọi liên tiếp cùng HEAD
- Fallback fs walk vẫn hoạt động cho dir không phải git repo
- Benchmark cho thấy cải thiện measured

**Breaking change:** Không (fallback đủ).

---

### PHASE 2 — Tree-Sitter Analyzer Framework (Tuần 5-7)

**Mục tiêu:** Import parsing đúng cho mọi ngôn ngữ. Giải **trục F**.

**Deliverables:**

- [ ] Dep: `tree-sitter` + `tree-sitter-javascript` + `tree-sitter-typescript` + `tree-sitter-python` + `tree-sitter-go` + `tree-sitter-rust` (WASM)
- [ ] Module `src/analyzers/spi.ts` — Analyzer interface:
  ```ts
  interface Analyzer {
    readonly language: Language;
    readonly extensions: string[];
    detect(filePath: string, content?: string): boolean;
    parseImports(file: SourceFile): Import[];
    parseExports(file: SourceFile): Export[];
    detectFrameworks?(file: SourceFile): FrameworkHint[];
    parseSymbols?(file: SourceFile): Symbol[];
  }
  ```
- [ ] Implement `analyzers/javascript/` (thay regex hiện tại, test parity trên fixture)
- [ ] Implement `analyzers/python/`, `analyzers/go/`, `analyzers/rust/`
- [ ] `analyzers/registry.ts` — discover + dispatch by extension
- [ ] Rewrite `scanDependencies` để route qua analyzer registry
- [ ] Golden tests: mỗi analyzer có 20+ snippet expected imports
- [ ] Benchmark WASM load time; lazy-load analyzer chỉ khi gặp extension tương ứng
- [ ] Tool mới `vibeguide_language_support` liệt kê analyzer active

**Exit criteria:**
- 100% parity với regex cũ trên JS/TS (không regress)
- Python/Go/Rust: dep graph correctness ≥95% trên 10 OSS fixture (vd: flask, gin, serde)
- WASM lazy-load: cold start vibeguide vẫn <500ms
- Hotspot `scanner.ts` loc < 150

**Breaking change:** Dep graph cho py/go/rust file sẽ **đột nhiên có edges** nơi trước đây rỗng. User có thể thấy "regression" ở impact/circular_deps. Mitigate: changelog nổi bật + flag `--legacy-parser` cho 1 minor version.

**Size note:** Tree-sitter WASM ~2-5MB mỗi grammar. Plan: ship JS/TS trong default; py/go/rust optional install (`npm i vibeguide-lang-python`).

---

### PHASE 3 — Incremental Index (Tuần 8-9)

**Mục tiêu:** Don't re-compute. Opt-in SQLite index cho repo lớn. Giải performance trên repo 100k+ files.

**Deliverables:**

- [ ] Dep: `better-sqlite3` (prebuilt binary, Windows OK)
- [ ] `src/index/store.ts` — thin wrapper, migration-aware
- [ ] `src/index/schema.sql`:
  ```sql
  CREATE TABLE files (
    path TEXT PRIMARY KEY,
    git_oid TEXT NOT NULL,
    language TEXT,
    lines INTEGER,
    last_indexed_at INTEGER
  );
  CREATE TABLE imports (
    from_file TEXT, to_file TEXT, specifier TEXT,
    FOREIGN KEY (from_file) REFERENCES files(path)
  );
  CREATE TABLE exports (file TEXT, symbol TEXT, kind TEXT, line INTEGER);
  CREATE TABLE symbols (file TEXT, name TEXT, kind TEXT, line INTEGER, scope TEXT);
  CREATE TABLE ownership (file TEXT, author TEXT, commits INTEGER, last_touch INTEGER);
  CREATE TABLE commits (sha TEXT PRIMARY KEY, author TEXT, message TEXT, timestamp INTEGER);
  CREATE TABLE embeddings (file TEXT, chunk_id INTEGER, vector BLOB);
  CREATE INDEX idx_imports_to ON imports(to_file);
  CREATE INDEX idx_commits_time ON commits(timestamp);
  ```
- [ ] Invalidation: per-file git blob OID so với DB → chỉ re-analyze file đổi OID
- [ ] `vibeguide_index_build` / `vibeguide_index_status` / `vibeguide_index_clear`
- [ ] Auto-detect: nếu `.vibeguide/index.db` tồn tại và fresh → queries dùng nó; else fallback in-memory scan
- [ ] Queries layer rewrite để có 2 implementation: `InMemoryQueries` và `SqliteQueries`, cùng interface
- [ ] Benchmark: `impact` trên 100k-file repo với index: <200ms; không index: baseline

**Exit criteria:**
- Project nhỏ (< 1000 files): không cần index, zero-config vẫn nhanh
- Project lớn (100k files): `vibeguide_index_build` < 60s; sau đó mọi query <1s
- Invalidation chính xác: đổi 1 file chỉ re-index file đó + reverse imports

**Breaking change:** Không. Index là opt-in.

---

### PHASE 4 — Workspace & Federation (Tuần 10-12)

**Mục tiêu:** Multi-repo thành first-class. Giải **trục C** và nâng trục B.

**Deliverables:**

- [ ] Spec `vibeguide.workspace.yaml` (xem §3.2)
- [ ] `src/core/workspace.ts` — parse, validate, resolve paths
- [ ] Tools mới:
  - `vibeguide_workspace_init` — tạo template yaml, auto-detect repos trong folder cha
  - `vibeguide_workspace_scan` — scan all repos, aggregate stats
  - `vibeguide_workspace_impact` — cross-repo impact dựa vào contracts
  - `vibeguide_contract_check` — validate contract giữa producer và consumer
  - `vibeguide_contract_diff` — khi spec đổi, consumer nào break
- [ ] Contract parsers: OpenAPI 3.x, gRPC .proto, GraphQL SDL, JSON Schema
- [ ] `src/bridges/gitnexus.ts`:
  ```ts
  if (await GitNexusBridge.isAvailable(workspace)) {
    return GitNexusBridge.impact(scope);
  } else {
    return localImpactForEachRepo(workspace);
  }
  ```
- [ ] Bridge fallback graceful: GitNexus offline → warning + local path
- [ ] Workspace-aware reports (`founder_brief` aggregate across repos)

**Exit criteria:**
- Có thể trace "user click login trên web → gọi auth API → validate JWT ở auth-service → query user DB"
- Contract diff phát hiện breaking change (vd: rename field OpenAPI)
- GitNexus bridge: nếu có, kết quả `workspace_impact` identical (so với local fallback) trên fixture test

**Breaking change:** Không với single-repo users. Mới entirely cho multi-repo users.

---

### PHASE 5 — Time Travel (Tuần 13-14)

**Mục tiêu:** Lịch sử thành dimension first-class. Giải **trục D** hoàn toàn.

**Deliverables:**

- [ ] `src/queries/ownership.ts` — git blame aggregation, bus factor analysis
- [ ] `src/queries/churn.ts` — file change frequency, hotspot detection
- [ ] Tools mới:
  - `vibeguide_ownership` — ai sở hữu file/module, bus factor
  - `vibeguide_churn` — file nào đổi nhiều nhất, top hotspots
  - `vibeguide_retrospective` — `--since=3.months.ago` → báo cáo "chuyện gì đã xảy ra"
  - `vibeguide_historical_diff` — so sánh metric hiện tại vs 6 tháng trước (complexity trend, dep count trend)
- [ ] `vibeguide_snapshot` v2: store git SHA thay vì full content. "Snapshot" = bookmark + label + optional working-tree diff patch. Giảm storage 100×+
- [ ] Tool `vibeguide_rewind` — checkout hidden branch tại snapshot để preview
- [ ] `founder_brief` nâng cấp: hiển thị trend ("complexity tuần này +5% so với tuần trước")
- [ ] `changelog` thông minh: group commit theo theme (feature/fix/chore), dùng conventional-commits nếu có

**Exit criteria:**
- `vibeguide_ownership src/utils/scanner.ts` trả về đúng author + % contributions
- `vibeguide_snapshot create` < 100ms cho repo 10k files (vì chỉ lưu SHA)
- `vibeguide_retrospective --days=90` render markdown timeline đọc được

**Breaking change:** Snapshot format v1 → v2. Cung cấp migration tool `vibeguide_snapshot_migrate`.

---

### PHASE 6 — Streaming Output + Budget (Tuần 15-16)

**Mục tiêu:** Không bao giờ blow context window. Tool output infinitely large, agent consume pieces.

**Deliverables:**

- [ ] `transport/mcp/streaming.ts` — MCP progress notifications + chunked responses
- [ ] Mọi tool accept param `budget: { tokens, depth }`
- [ ] Output mặc định `depth: "normal"` cắt gọn; `"deep"` trả full; `"summary"` chỉ headline
- [ ] Pagination protocol:
  ```ts
  { data: [...], nextPageToken?: string, totalItems: number }
  ```
- [ ] `vibeguide_page` — generic tool fetch next page bằng token
- [ ] Replace `toolOutput.ts::compressOutput` bằng stream-first approach — tools tự giới hạn output trước khi build full, không post-hoc cắt
- [ ] `Report` interface: render với budget awareness
- [ ] Chia output cho AI: **data chunk** (machine) + **narrative chunk** (human)

**Exit criteria:**
- `scan_repo` trên 100k-file repo: response < 4KB summary + page tokens
- `impact` deep mode chunked, agent request page 2, page 3... không mất context
- Memory peak của server < 200MB ngay cả khi query repo 1M LOC

**Breaking change:** Output schema mới cho mọi tool. Cung cấp `legacyOutput: true` flag trong 1 minor.

---

### PHASE 7 — Intelligence Loop (Tuần 17-19)

**Mục tiêu:** VibeGuide học từ usage. Heuristic dần chính xác theo thời gian.

**Deliverables:**

- [ ] Dep: `@xenova/transformers` (local ONNX embeddings, ~30MB model)
- [ ] `src/index/embeddings.ts` — compute per-function embeddings, store SQLite
- [ ] Tools mới:
  - `vibeguide_semantic_search` — "tìm nơi xử lý thanh toán" → top-k functions
  - `vibeguide_similar_bugs` — given bug report, tìm issue tương tự trong lịch sử
  - `vibeguide_learn_feedback` — user mark suggestion "helpful/not helpful", weights adjusted
- [ ] Feedback store SQLite:
  ```sql
  CREATE TABLE feedback (
    signal_id TEXT, action TEXT,
    timestamp INTEGER, note TEXT
  );
  ```
- [ ] Heuristics (`heuristics.ts`, `fixSuggestions.ts`) giờ weighted bằng feedback history
- [ ] `vibeguide_suggest_fix` v2: kết hợp heuristic + embedding similarity + feedback learned
- [ ] Privacy: embedding local only, opt-out env var

**Exit criteria:**
- Semantic search precision@5 ≥ 60% trên 3 test codebase
- Feedback loop measurable: suggestion acceptance rate tăng theo thời gian
- Total index size (embedding + graph) < 500MB cho 100k files

**Breaking change:** Không. Tính năng mới thuần túy.

**Risk:** Local embedding model size/perf. Mitigate: tuỳ chọn model (all-MiniLM-L6-v2 mặc định — 30MB; user chọn bigger qua config).

---

### PHASE 8 — Platform Surface (Tuần 20-22)

**Mục tiêu:** Vượt MCP. Chạy được trong CI, dashboard, notification.

**Deliverables:**

- [ ] `transport/cli/` — `npx vibeguide <command>`:
  - `vibeguide scan [path]`
  - `vibeguide impact <file>`
  - `vibeguide review-pr [branch]`
  - `vibeguide founder-brief --days=7`
  - `vibeguide workspace <cmd>`
- [ ] Package `bin/vibeguide` + prebuilt single-file binary qua `pkg` hoặc `bun build --compile`
- [ ] `transport/http/` — local HTTP server (opt-in):
  - POST /tools/:name
  - GET /sse (streaming)
  - Auth: loopback only mặc định, token optional
- [ ] `transport/dashboard/` — static SPA đọc `.vibeguide/index.db`:
  - Trang chủ: repo health score
  - Deps graph (vis.js)
  - Timeline commits + snapshots
  - Signals inbox (bug/a11y/perf/sec)
  - Founder view (non-tech)
- [ ] GitHub Action:
  ```yaml
  - uses: hungf1511/vibeguide-action@v2
    with:
      command: review-pr
      fail-on: block
  ```
  Render kết quả lên PR comment + check annotations
- [ ] Slack/Discord notifier (webhook):
  - Daily brief
  - Regression alert
  - Deploy gate fail
- [ ] VS Code extension (lightweight) — inline signals trong editor

**Exit criteria:**
- CLI ship standalone không cần npm dependency
- Dashboard load repo 10k files < 2s
- GitHub Action chạy review-pr < 2 phút trên repo size Next.js starter

**Breaking change:** Không (toàn bộ additive).

---

### PHASE 9 — Plugin System (Tuần 23-24)

**Mục tiêu:** Community extensibility.

**Deliverables:**

- [ ] Plugin SPI `src/plugins/spi.ts`:
  ```ts
  interface VibeGuidePlugin {
    name: string;
    version: string;
    analyzers?: Analyzer[];
    tools?: ToolDef[];
    reports?: ReportDef[];
    init?(ctx: PluginContext): Promise<void>;
  }
  ```
- [ ] Plugin loader: npm package naming convention `vibeguide-plugin-*`
- [ ] Sandbox: plugins run trong `worker_threads` với restricted API (no fs write ngoài cwd, no network unless declared)
- [ ] Permission manifest trong plugin package.json:
  ```json
  "vibeguide": {
    "permissions": ["read:files", "read:git", "network:api.openai.com"]
  }
  ```
- [ ] Registry CLI: `vibeguide plugin install <name>`
- [ ] Official plugins seed:
  - `vibeguide-plugin-openai` — AI-powered explanations
  - `vibeguide-plugin-linear` — Linear issue linking
  - `vibeguide-plugin-jest` — Jest test insights
  - `vibeguide-plugin-sentry` — Sentry error correlation

**Exit criteria:**
- Plugin install/uninstall không vỡ core
- Malicious plugin không exfiltrate data (pen-test manual)
- Official plugins tất cả cài được

**Breaking change:** Có nếu user hack vào internals. Document "public API" vs "internal".

---

### PHASE 10 — Polish & Launch 2.0 (Tuần 25-26)

**Mục tiêu:** Production-ready, documented, migratable.

**Deliverables:**

- [ ] Docs site (Docusaurus hoặc VitePress): `/docs`
  - Getting Started (3 cấp: Founder / Dev / Plugin author)
  - Tool reference (tự generate từ schemas)
  - Architecture
  - Migration guide 1.x → 2.x
  - Cookbook (10+ real scenarios)
- [ ] i18n:
  - `src/core/i18n.ts` với `en`, `vi` resources
  - Tất cả output user-facing đi qua i18n
  - Founder brief render by locale
- [ ] Migration tool `vibeguide migrate` — auto-convert config cũ, flag breaking changes trong codebase caller
- [ ] Error taxonomy — tất cả error có code ổn định (`VG001` ... `VG999`), i18n message
- [ ] Performance regression CI check: benchmarks compare vs baseline, fail nếu regress >20%
- [ ] Security audit: `npm audit`, Snyk scan, review bridge permissions
- [ ] Release 2.0.0 → Announce

**Exit criteria:**
- Docs site deployed
- Migration script tested trên 5 real 1.x users
- Benchmarks green
- Self-dogfood: VibeGuide 2.0 phân tích chính repo VibeGuide clean slate ≤ 30s

**Breaking change:** Tổng hợp từ các phase trước, có migration guide + script.

---

## 5. Cross-Cutting Concerns

### 5.1 Backwards Compatibility Strategy

| Phase | Breaking? | Mitigation |
|---|---|---|
| 0 | Không | `newHandlers.ts` giữ barrel re-export |
| 1 | Không | Fallback fs walk |
| 2 | Silent accuracy bump | Changelog emphasized, `--legacy-parser` flag |
| 3 | Không | Index opt-in |
| 4 | Không (additive) | — |
| 5 | Snapshot format | `vibeguide_snapshot_migrate` |
| 6 | Output schema | `legacyOutput: true` flag 1 minor |
| 7 | Không | — |
| 8 | Không | — |
| 9 | Internal API | Document public vs internal |
| 10 | Tổng hợp | Auto migration script |

### 5.2 Performance Targets

| Scenario | Target v1 | Target v2 | Cách đạt |
|---|---|---|---|
| Small repo (<1k files) scan | ~1s | ~300ms | Phase 1 (git ls-files) |
| Medium (10k files) scan | ~10s | ~1s | Phase 1 + 2 |
| Large (100k files) scan | ??? | ~5s + index | Phase 3 |
| XL (1M LOC) impact | N/A | <500ms với index | Phase 3 + 6 |
| Monorepo 50 packages scoped | ~30s | ~200ms | Phase 1 scope + 3 index |
| Workspace 10 repos impact | N/A | <5s | Phase 4 + GitNexus bridge |
| MCP cold start | ~400ms | <300ms | Phase 2 lazy load |
| Memory peak on 1M LOC | ??? | <300MB | Phase 6 streaming |

### 5.3 Security

- **Command injection:** mọi subprocess dùng `execFile` với args array (không dùng shell interpolation). Validator kiểm tra args trước khi spawn.
- **Path traversal:** `pathGuard.ts` đã có, extend cho workspace paths
- **Index DB:** local only, no network IO; encrypted at rest optional (Phase 10)
- **Plugin sandbox:** worker_threads + permission manifest
- **Secrets:** `secret_scan` v2 với entropy + rule-based; plugin có thể thêm custom rules
- **Network:** core có 0 network calls. Bridges (GitNexus, GitHub) opt-in, declared
- **Supply chain:** `npm audit` in CI, Renovate bot cho deps update

### 5.4 Testing Strategy

**5 levels:**

1. **Unit** — mỗi util module (target ≥80% coverage core, ≥60% tools)
2. **Property** — fuzz import parsers (random code snippets → expect no crash, sensible output)
3. **Integration** — fixture repos:
   - `fixtures/small-ts/` — 50 files, React + Next
   - `fixtures/monorepo-pnpm/` — 5 packages
   - `fixtures/polyglot/` — TS + Python + Go trong 1 repo
   - `fixtures/multi-repo/` — 3 repo + workspace.yaml
   - `fixtures/large/` — generated 10k files (build-time)
4. **Benchmark** — tinybench, compare per-commit vs baseline
5. **Dogfood** — mỗi phase: VibeGuide phân tích chính mình, kết quả đưa vào `docs/dogfood-logs/<phase>.md`

### 5.5 Observability

- Structured logs (JSON stderr) với tool, duration, cache-hit, memory
- Optional telemetry: opt-in, no PII, aggregate only (# of tool invocations)
- Debug mode: `VIBEGUIDE_DEBUG=1` dumps timing waterfall

### 5.6 Versioning

- SemVer strict
- Tất cả phase 0-9 stay on v1.x minors
- Phase 10 = v2.0.0
- v1.x maintained bugfix-only for 6 tháng sau v2 release

### 5.7 Documentation

- `README.md` (vi), `README_EN.md` — quick start, không > 200 dòng mỗi cái
- `docs/` site:
  - `/getting-started/` — 3 personas
  - `/concepts/` — Scope, Workspace, Contract, Signal, Budget
  - `/tools/` — auto-generated reference
  - `/guides/` — cookbook
  - `/internals/` — cho contributor
  - `/plugin-authors/` — SPI docs

### 5.8 Internationalization

- Core: en (source of truth), vi (first-class)
- Community: future extension via plugins
- Output locale detect qua `VIBEGUIDE_LOCALE` env hoặc workspace config
- Founder brief quan trọng nhất i18n chuẩn

---

## 6. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Tree-sitter WASM tăng install size | H | M | Lazy load, per-language packages |
| R2 | SQLite native binding fail trên Windows | M | H | Use better-sqlite3 prebuilt, fallback in-memory |
| R3 | Git binary không available | L | H | simple-git là pure JS fallback |
| R4 | GitNexus API đổi breaking | M | M | Bridge adapter, version pin |
| R5 | Plugin security exploit | M | H | Worker sandbox, permission manifest, audit |
| R6 | Embedding model size > budget | M | M | Default smallest model, opt-in bigger |
| R7 | Phase 4 workspace concept quá phức tạp | H | M | Auto-detect default, progressive disclosure |
| R8 | User community fragmented (vi/en) | M | L | Docs i18n từ đầu |
| R9 | Performance regression khi thêm feature | H | H | Benchmark CI fail gate, profiling |
| R10 | Maintainer bandwidth | H | H | Phase độc lập; dừng phase bất kỳ vẫn usable |
| R11 | Breaking changes irritate existing users | H | M | 2-minor deprecation, migration script |
| R12 | Dogfood không detect regression real-world | M | M | Beta users recruiting, ecosystem plugins |

---

## 7. Success Metrics

### 7.1 Phase-level
- Test coverage ≥ target
- Benchmark improvement measured
- Dogfood output cleaner (giảm signals của VibeGuide về VibeGuide)
- Zero regression trong tool hiện tại

### 7.2 v2.0 overall
- **Handle 1M LOC polyglot monorepo spanning 10 repos over 3 years of history**
- Cold start < 300ms
- Scan scoped < 1s ở mọi size
- Memory peak < 300MB
- GitHub star: ≥5× baseline (vanity metric nhưng proxy cho adoption)
- Plugin ecosystem: ≥5 community plugins 6 tháng sau v2
- VS Code extension ≥1000 installs
- Npm downloads ≥10× baseline

### 7.3 Real user value (priority cao nhất — theo memory của user)
- Founder VN dùng `founder_brief` hiểu được không cần tech-speak
- Dev VN dùng `impact` trước khi refactor, measured khả năng rollback giảm
- Team dùng `workspace_impact` trước khi merge cross-service PR
- `a11y_check` + `i18n_gap` flags thật sự catch vấn đề cho end user VN

---

## 8. Immediate Next Steps (Tuần 0 — Tuần này)

**Quyết định cần maintainer (trước khi bắt đầu Phase 0):**

1. **Approve plan** hoặc request thay đổi (scope/order/timeline)
2. **Branching model:**
   - (a) `main` là v1 bugfix, `v2-dev` là tất cả phase
   - (b) `main` rolling v2, release tag khi phase done
   - Khuyến nghị: (b) với strict CI gate
3. **Issue labels:** `phase-0`, `phase-1`, ..., `breaking`, `docs`, `good-first-issue`
4. **Milestone tracking:** tạo 11 milestone trong GitHub (Phase 0 → Phase 10)
5. **Public announcement:** viết blog post "VibeGuide 2.0 Roadmap" để community biết + recruit beta testers
6. **Contributor onboarding:** ai muốn join? Ít nhất cần 2-3 người để ship 6 tháng

**Phase 0 kick-off checklist:**

- [ ] Tạo branch `v2-dev`
- [ ] PR #1: `vitest` setup + CI
- [ ] PR #2: Split `newHandlers.ts`
- [ ] PR #3: Benchmark harness + fixtures
- [ ] PR #4: Write 5 unit tests (scanner, cache, ...)
- [ ] PR #5: `docs/architecture.md`, `docs/contributing.md`
- [ ] Milestone "Phase 0" close → release v1.1.0

---

## Appendix A — Tool Migration Table (34 tools × 11 phases)

| Tool | P0 | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `scan_repo` | refactor | git ls-files | tree-sitter | index-aware | workspace mode | scope.since | streaming | | CLI | | i18n | Tăng tốc mạnh |
| `get_file` | | | | | | | streaming | | | | | |
| `get_deps` | | | analyzer-correct | index | workspace | | streaming | | | | | Cross-lang đúng |
| `dependency_graph` | | | accurate | index | workspace-wide | | pagination | | dashboard viz | | | |
| `trace_journey` | | scope.since | | index | cross-repo | | streaming | semantic | | | i18n | |
| `heuristic_bug` | | | | | | | | learned weights | | | i18n | |
| `regression` | | diff-aware | | | | historical | | | | | | |
| `test_plan` | | | | | | | | learned | | | i18n | |
| `bug_report` | | | | | | | | | | | i18n | |
| `suggest_fix` | | | | | | | | learned+embeddings | | | i18n | |
| `impact` | | | correct cross-lang | index | workspace | historical | streaming | | | | | |
| `impact_confirm` | | | | | | | | | | | | |
| `snapshot` | | | | | | sha-based v2 | | | dashboard | | | **Breaking** |
| `diff_summary` | | git-native | | | | | | | | | | |
| `deploy_check` | refactor (31→<15) | | | | workspace gates | | | | | | | Hotspot |
| `changelog` | | git log | | | | historical themes | | | | | i18n | |
| `what_changed` | | git diff | | | | | | | | | | |
| `smart_route` | | | | | | | | learned | | plugin-aware | | |
| `session_status` | | | | | workspace-wide | | | | | | i18n | |
| `export_report` | | | | | | | | | multi-format | | i18n | |
| `type_check` | | | | | | | | | | plugin provider | | |
| `test_coverage` | | | | | | | | | | plugin provider | | |
| `circular_deps` | | | correct | index | workspace | | | | dashboard viz | | | |
| `dead_code` | refactor (19→<15) | | correct | index | workspace | | | | | | | |
| `complexity` | | | per-lang | | | historical trend | | | | | | |
| `a11y_check` | | | framework-aware | | | | | | | plugin | i18n | |
| `secret_scan` | | | | | | | | | CI mode | custom rules plugin | | |
| `i18n_gap` | | | | | | | | | | plugin | vi-first | **Critical cho user VN** |
| `doc_gap` | | | | | | | | | | | | |
| `perf_budget` | | | | | | | | | | | | |
| `monorepo_route` | | | | index | enhanced | | | | | | | |
| `review_pr` | refactor | | | | workspace PR | historical context | | | GH action | | i18n | |
| `founder_brief` | | | | | workspace-wide | historical trend | | | Slack format | | **vi-first** | |
| `meeting_notes` | | | | | | | | | | | i18n | |

**Tools mới (v2):**
- `vibeguide_git_status`, `vibeguide_git_log` — P1
- `vibeguide_language_support` — P2
- `vibeguide_index_build/status/clear` — P3
- `vibeguide_workspace_init/scan/impact` — P4
- `vibeguide_contract_check/diff` — P4
- `vibeguide_ownership`, `vibeguide_churn`, `vibeguide_retrospective`, `vibeguide_historical_diff`, `vibeguide_rewind` — P5
- `vibeguide_page` — P6
- `vibeguide_semantic_search`, `vibeguide_similar_bugs`, `vibeguide_learn_feedback` — P7

Tổng: 34 + ~16 = ~50 tools v2.

---

## Appendix B — Code Sketches

### B.1 Tree-sitter analyzer (Python)

```ts
// src/analyzers/python/index.ts
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { Analyzer, SourceFile, Import } from "../spi.js";

const parser = new Parser();
parser.setLanguage(Python);

const IMPORT_QUERY = Python.query(`
  (import_statement name: (dotted_name) @module)
  (import_from_statement module_name: (dotted_name) @module)
`);

export const pythonAnalyzer: Analyzer = {
  language: "python",
  extensions: [".py"],
  detect: (file) => file.endsWith(".py"),
  parseImports(file: SourceFile): Import[] {
    const tree = parser.parse(file.content);
    const matches = IMPORT_QUERY.matches(tree.rootNode);
    return matches.map((m) => ({
      from: file.path,
      specifier: m.captures[0].node.text,
      line: m.captures[0].node.startPosition.row + 1,
    }));
  },
  parseExports: () => [],
};
```

### B.2 Workspace manifest resolve

```ts
// src/core/workspace.ts
export interface Workspace {
  name: string;
  root: string;
  repos: Map<string, WorkspaceRepo>;
  contracts: Contract[];
}

export async function loadWorkspace(file: string): Promise<Workspace> {
  const raw = yaml.parse(await fs.readFile(file, "utf-8"));
  const root = path.dirname(file);
  const repos = new Map<string, WorkspaceRepo>();
  for (const [name, def] of Object.entries(raw.repos)) {
    repos.set(name, {
      name,
      path: path.resolve(root, def.path),
      language: def.language,
    });
  }
  const contracts = await Promise.all((raw.contracts || []).map(parseContract));
  return { name: raw.name, root, repos, contracts };
}
```

### B.3 GitNexus bridge

```ts
// src/bridges/gitnexus.ts
export class GitNexusBridge {
  static async isAvailable(workspace: Workspace): Promise<boolean> {
    try {
      const client = new McpClient({ server: "gitnexus" });
      await client.callTool("list_repos", {});
      return true;
    } catch {
      return false;
    }
  }

  static async workspaceImpact(workspace: Workspace, file: string): Promise<ImpactResult> {
    const client = new McpClient({ server: "gitnexus" });
    const cypher = `
      MATCH (f:File {path: $file})
      CALL gitnexus.impact(f, {maxDepth: 5})
      YIELD affected
      RETURN affected
    `;
    return await client.callTool("group_query", { cypher, params: { file } });
  }
}
```

### B.4 Streaming MCP response

```ts
// src/transport/mcp/streaming.ts
export async function* streamSignals(
  signals: AsyncIterable<Signal>,
  budget: Budget,
): AsyncGenerator<McpChunk> {
  let tokensUsed = 0;
  const pageSize = 20;
  let buffer: Signal[] = [];
  for await (const signal of signals) {
    buffer.push(signal);
    tokensUsed += estimateTokens(signal);
    if (buffer.length >= pageSize || tokensUsed >= (budget.tokens ?? 4000)) {
      yield { data: buffer, nextPageToken: makeToken() };
      buffer = [];
      if (tokensUsed >= (budget.tokens ?? 4000)) break;
    }
  }
  if (buffer.length) yield { data: buffer };
}
```

### B.5 SQLite index invalidation

```ts
// src/index/store.ts
export async function rebuildIfStale(db: Database, repo: string): Promise<number> {
  const gitFiles = await git.lsFiles(repo);
  const indexed = db.prepare("SELECT path, git_oid FROM files").all() as { path: string; git_oid: string }[];
  const indexedMap = new Map(indexed.map(r => [r.path, r.git_oid]));

  let reIndexed = 0;
  const stmt = db.prepare("INSERT OR REPLACE INTO files VALUES (?, ?, ?, ?, ?)");

  for (const { path, oid } of gitFiles) {
    if (indexedMap.get(path) === oid) continue;
    const content = await git.showBlob(repo, oid);
    const lang = detectLanguage(path);
    stmt.run(path, oid, lang, content.split("\n").length, Date.now());
    await reanalyzeFile(db, path, content, lang);
    reIndexed++;
  }

  const gitSet = new Set(gitFiles.map(f => f.path));
  for (const { path } of indexed) {
    if (!gitSet.has(path)) {
      db.prepare("DELETE FROM files WHERE path = ?").run(path);
      db.prepare("DELETE FROM imports WHERE from_file = ?").run(path);
    }
  }

  return reIndexed;
}
```

---

## Appendix C — Open Questions (cần bàn với maintainer)

1. **Tên brand v2:** giữ "VibeGuide" hay rebrand? (khuyến nghị: giữ)
2. **License:** hiện tại là gì? Phase 9 plugin ecosystem có ý nghĩa nếu license permissive (MIT/Apache)
3. **Funding model:** OSS tuyệt đối hay có tier trả phí (cloud-hosted index cho team)?
4. **GitNexus tight integration:** có muốn VibeGuide trở thành "preferred UI" của GitNexus không, hay chỉ 1 optional bridge?
5. **Web dashboard hosting:** static files only hay có cloud version?
6. **AI cost:** embeddings local OK, nhưng LLM explanations cần API key của user. Default off hay đề xuất on?
7. **CLI binary distribution:** npm, brew, scoop, binary releases — tất cả?
8. **Telemetry:** có hay không? Opt-in mặc định hay opt-out? (Khuyến nghị: opt-in only)
9. **Languages ngoài JS/TS/Py/Go/Rust:** Java, C#, Kotlin, Swift, Dart — phase nào?
10. **Windows-first vs Linux-first:** user hiện tại Windows, nhưng hầu hết Node ecosystem Linux-first. Ưu tiên test matrix?

---

## Appendix D — Dogfood Report (2026-04-24)

Chạy tool VibeGuide trên chính `C:/Users/User/vibeguide`:

- `scan_repo`: 49 file, branch main, clean
- `complexity`: 7 hotspot, top `deploy.ts` (31)
- `circular_deps`: 0 cycle
- `dead_code`: 0 unused, 0 orphan
- `doc_gap`: 4 folder thiếu README, 80 export thiếu JSDoc
- `test_coverage`: không có coverage report
- `founder_brief (30d)`: đã mở rộng lên 34 tools, add GitHub Action, session_status

**Actionable signals từ chính VibeGuide:**

- [Phase 0] 80 JSDoc gaps → fix khi refactor handlers
- [Phase 0] 4 README gaps → viết cho `src/`, `src/mcp`, `src/mcp/handlers`, `src/utils`
- [Phase 0] 0 test coverage → **P0 blocker**, phải có trước mọi refactor
- [Phase 0] Hotspot `deploy.ts` cyclomatic 31 → split thành sub-checks
- [Phase 2] Python/Go/Rust parser hiện tại **sai** dù có .py/.go/.rs detection → rebuild với tree-sitter

---

## Kết

Plan này dài vì user yêu cầu "tối ưu đến giới hạn". Không phải phase nào cũng cần làm — đọc để **thấy bản đồ**. Có thể dừng ở Phase 4 đã là 1 VibeGuide 1.5 rất mạnh, Phase 7 là 2.0 ambitious, Phase 10 là production-grade platform.

Mỗi phase thiết kế **độc lập**: dừng bất cứ đâu vẫn có deliverable usable. Không có phase nào phụ thuộc tuyệt đối vào phase sau.

Trước khi commit vào plan này, suggest maintainer:
1. Review & chỉnh scope phase
2. Cân nhắc dành 1-2 tuần Phase 0 trước vì mọi thứ sau phụ thuộc vào test infra
3. Announce roadmap công khai để thu hút contributor
4. Chọn 2-3 phase ambitious làm "big bets" thay vì dải đều
