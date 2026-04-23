// ============================================================
// VibeGuide MCP Test Harness
// Chạy bằng: node test-mcp.js
// Không cần biết code — chỉ cần đọc output xanh/đỏ
// ============================================================

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`${GREEN}✓ PASS${RESET}: ${message}`);
    passCount++;
  } else {
    console.log(`${RED}✗ FAIL${RESET}: ${message}`);
    failCount++;
  }
}

async function runTests() {
  console.log('=== KHỞI ĐỘNG VIBEGUIDE TEST ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
  });

  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(transport);
  console.log('Connected to VibeGuide MCP Server\n');

  // ─── TEST 1: Liệt kê tools ─────────────────────────────────
  console.log('--- TEST 1: tools/list ---');
  const tools = await client.listTools();
  assert(tools.tools.length === 20, `Có đúng 20 tools (hiện có: ${tools.tools.length})`);
  assert(tools.tools.some(t => t.name === 'vibeguide_impact'), 'Có tool vibeguide_impact');
  assert(tools.tools.some(t => t.name === 'vibeguide_scan_repo'), 'Có tool vibeguide_scan_repo');
  assert(tools.tools.some(t => t.name === 'vibeguide_suggest_fix'), 'Có tool vibeguide_suggest_fix');
  assert(tools.tools.some(t => t.name === 'vibeguide_changelog'), 'Có tool vibeguide_changelog');
  assert(tools.tools.some(t => t.name === 'vibeguide_dependency_graph'), 'Có tool vibeguide_dependency_graph');
  assert(tools.tools.some(t => t.name === 'vibeguide_smart_route'), 'Có tool vibeguide_smart_route');
  assert(tools.tools.some(t => t.name === 'vibeguide_session_status'), 'Có tool vibeguide_session_status');
  assert(tools.tools.some(t => t.name === 'vibeguide_export_report'), 'Có tool vibeguide_export_report');

  // ─── TEST 2: Scan repo ─────────────────────────────────────
  console.log('\n--- TEST 2: vibeguide_scan_repo ---');
  const r1 = await client.callTool({ name: 'vibeguide_scan_repo', arguments: { repoPath: '.' } });
  const scan = JSON.parse(r1.content[0].text);
  assert(scan.stats.totalFiles > 0, `Repo có ${scan.stats.totalFiles} files`);
  assert(scan.stats.totalFolders > 0, `Repo có ${scan.stats.totalFolders} folders`);
  assert(Array.isArray(scan.edges), `Có dependency edges: ${scan.edges.length}`);

  // ─── TEST 3: Get dependencies ────────────────────────────────
  console.log('\n--- TEST 3: vibeguide_get_deps ---');
  const r2 = await client.callTool({ name: 'vibeguide_get_deps', arguments: { repoPath: '.' } });
  const deps = JSON.parse(r2.content[0].text);
  assert(deps.nodes.length > 0, `Có ${deps.nodes.length} files trong graph`);

  // ─── TEST 4: Impact analysis ────────────────────────────────
  console.log('\n--- TEST 4: vibeguide_impact ---');
  const r3 = await client.callTool({
    name: 'vibeguide_impact',
    arguments: { filePath: 'src/mcp/server.ts', repoPath: '.' }
  });
  const impact = JSON.parse(r3.content[0].text);
  assert(['low', 'medium', 'high'].includes(impact.risk), `Risk hợp lệ: ${impact.risk}`);
  assert(Array.isArray(impact.affectedFiles), 'Có affectedFiles array');

  // ─── TEST 5: Heuristic bug scan ──────────────────────────────
  console.log('\n--- TEST 5: vibeguide_heuristic_bug ---');
  const r4 = await client.callTool({
    name: 'vibeguide_heuristic_bug',
    arguments: { symptom: 'login fails', repoPath: '.' }
  });
  const bug = JSON.parse(r4.content[0].text);
  assert(Array.isArray(bug.suspiciousFiles), 'Có suspiciousFiles array');
  assert(Array.isArray(bug.matches), 'Có matches array');

  // ─── TEST 6: Bug report format ──────────────────────────────
  console.log('\n--- TEST 6: vibeguide_bug_report ---');
  const r5 = await client.callTool({
    name: 'vibeguide_bug_report',
    arguments: { description: 'I click login button and nothing happens', repoPath: '.' }
  });
  const report = JSON.parse(r5.content[0].text);
  assert(report.severity === 'high' || report.severity === 'medium' || report.severity === 'low', `Severity hợp lệ: ${report.severity}`);
  assert(report.formatted.includes('Bug Report'), 'Format có tiêu đề Bug Report');

  // ─── TEST 7: Impact confirm ─────────────────────────────────
  console.log('\n--- TEST 7: vibeguide_impact_confirm ---');
  const r6 = await client.callTool({
    name: 'vibeguide_impact_confirm',
    arguments: { filePath: 'src/mcp/server.ts', repoPath: '.' }
  });
  const confirm = JSON.parse(r6.content[0].text);
  assert(typeof confirm.needsApproval === 'boolean', 'Có needsApproval boolean');
  assert(typeof confirm.downtime === 'string', 'Có downtime string');

  // ─── TEST 8: Test plan generation ───────────────────────────
  console.log('\n--- TEST 8: vibeguide_test_plan ---');
  const r7 = await client.callTool({
    name: 'vibeguide_test_plan',
    arguments: { feature: 'login', repoPath: '.' }
  });
  const plan = JSON.parse(r7.content[0].text);
  assert(plan.feature === 'login', 'Feature đúng: login');
  assert(Array.isArray(plan.steps) && plan.steps.length > 0, `Có ${plan.steps.length} bước test`);
  assert(Array.isArray(plan.expect) && plan.expect.length > 0, `Có ${plan.expect.length} expect`);

  // ─── TEST 9: Get file content ───────────────────────────────
  console.log('\n--- TEST 9: vibeguide_get_file ---');
  const r8 = await client.callTool({
    name: 'vibeguide_get_file',
    arguments: { filePath: 'package.json', repoPath: '.' }
  });
  const file = JSON.parse(r8.content[0].text);
  assert(file.content !== null, 'Đọc được file package.json');
  assert(file.content.includes('vibeguide'), 'File chứa tên project');

  // ─── TEST 10: Trace journey ─────────────────────────────────
  console.log('\n--- TEST 10: vibeguide_trace_journey ---');
  const r9 = await client.callTool({
    name: 'vibeguide_trace_journey',
    arguments: { journey: 'user clicks login button', repoPath: '.' }
  });
  const journey = JSON.parse(r9.content[0].text);
  assert(Array.isArray(journey.steps), 'Có steps array');
  assert(Array.isArray(journey.files), 'Có files array');

  // ─── TEST 11: Regression check ───────────────────────────────
  console.log('\n--- TEST 11: vibeguide_regression ---');
  const r10 = await client.callTool({
    name: 'vibeguide_regression',
    arguments: { changedFiles: ['src/mcp/server.ts'], repoPath: '.' }
  });
  const regression = JSON.parse(r10.content[0].text);
  assert(Array.isArray(regression.testFlows), 'Có testFlows array');
  assert(typeof regression.passed === 'boolean', 'Có passed boolean');

  // ─── TEST 12: What changed ────────────────────────────────────
  console.log('\n--- TEST 12: vibeguide_what_changed ---');
  const r11 = await client.callTool({
    name: 'vibeguide_what_changed',
    arguments: { repoPath: '.' }
  });
  const changelog = JSON.parse(r11.content[0].text);
  assert(Array.isArray(changelog.commits), 'Có commits array');
  assert(Array.isArray(changelog.files), 'Có files array');
  assert(Array.isArray(changelog.features), 'Có features array');

  // ─── TEST 13: Smart route ───────────────────────────────────
  console.log('\n--- TEST 13: vibeguide_smart_route ---');
  const r12 = await client.callTool({
    name: 'vibeguide_smart_route',
    arguments: { situation: 'UI chậm khi load trang', repoPath: '.' }
  });
  const smart = JSON.parse(r12.content[0].text);
  assert(typeof smart.detectedType === 'string', `Có detectedType: ${smart.detectedType}`);
  assert(Array.isArray(smart.recommendedPlugins), 'Có recommendedPlugins array');
  assert(Array.isArray(smart.vibeGuideTools), 'Có vibeGuideTools array');
  assert(typeof smart.summary === 'string', 'Có summary string');

  // ─── TEST 14: Session status ────────────────────────────────
  console.log('\n--- TEST 14: vibeguide_session_status ---');
  const r13 = await client.callTool({
    name: 'vibeguide_session_status',
    arguments: { repoPath: '.' }
  });
  const session = JSON.parse(r13.content[0].text);
  assert(typeof session.summary === 'string' && session.summary.length > 0, `Có summary: ${session.summary}`);
  assert(Array.isArray(session.timeline), 'Có timeline array');
  assert(typeof session.status === 'string', 'Có status string');

  await client.close();

  // ─── SUMMARY ────────────────────────────────────────────────
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${GREEN}PASS: ${passCount}${RESET} | ${RED}FAIL: ${failCount}${RESET}`);
  console.log(`${'='.repeat(50)}`);

  if (failCount > 0) {
    console.log(`\n${RED}❌ CÓ LỖI${RESET} — Kiểm tra các test FAIL ở trên`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}✅ TẤT CẢ TEST PASS${RESET} — VibeGuide MCP Server hoạt động chuẩn!`);
  }
}

runTests().catch(e => {
  console.error(`${RED}CRASH:${RESET}`, e.message);
  process.exit(1);
});
