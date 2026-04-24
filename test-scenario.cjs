// ============================================================
// VibeGuide Real-World Scenario Test
// Scenario: Founder báo "nút Thanh toán không ăn"
// ============================================================

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function runScenario() {
  console.log(`${CYAN}=== SCENARIO: Founder báo "nút Thanh toán không ăn" ===${RESET}\n`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
  });

  const client = new Client({ name: 'scenario-test', version: '1.0.0' });
  await client.connect(transport);

  const repo = './test-project';

  // Step 1: Scan repo để biết cấu trúc
  console.log(`${CYAN}[Dev]${RESET} Đầu tiên, quét repo để biết có file gì...`);
  const scan = await client.callTool({
    name: 'vibeguide_scan_repo',
    arguments: { repoPath: repo }
  });
  const scanResult = JSON.parse(scan.content[0].text);
  console.log(`  → Repo có ${scanResult.stats.totalFiles} files, ${scanResult.stats.totalFolders} folders`);
  console.log(`  → Có ${scanResult.edges.length} dependency edges\n`);

  // Step 2: Heuristic bug scan
  console.log(`${CYAN}[Dev]${RESET} Founder báo "nút Thanh toán không ăn", scan tìm lỗi...`);
  const bug = await client.callTool({
    name: 'vibeguide_heuristic_bug',
    arguments: { symptom: 'payment button not working checkout fails', repoPath: repo }
  });
  const bugResult = JSON.parse(bug.content[0].text);
  console.log(`  → Tìm thấy ${bugResult.suspiciousFiles.length} file nghi ngờ`);
  console.log(`  → Tìm thấy ${bugResult.matches.length} bug patterns`);
  bugResult.matches.forEach(m => {
    console.log(`    - ${m.pattern} at ${m.file}:${m.line} (score: ${m.score})`);
  });
  console.log();

  // Step 3: Trace journey
  console.log(`${CYAN}[Dev]${RESET} Trace luồng "user clicks Pay button"...`);
  const journey = await client.callTool({
    name: 'vibeguide_trace_journey',
    arguments: { journey: 'user clicks Pay button', repoPath: repo }
  });
  const journeyResult = JSON.parse(journey.content[0].text);
  console.log(`  → Files liên quan: ${journeyResult.files.join(', ')}`);
  console.log(`  → Confidence: ${journeyResult.confidence}`);
  journeyResult.steps.forEach(s => console.log(`    - ${s}`));
  console.log();

  // Step 4: Impact analysis
  console.log(`${CYAN}[Dev]${RESET} Nếu sửa src/hooks/useCart.ts, ảnh hưởng gì?`);
  const impact = await client.callTool({
    name: 'vibeguide_impact',
    arguments: { filePath: 'src/hooks/useCart.ts', repoPath: repo }
  });
  const impactResult = JSON.parse(impact.content[0].text);
  console.log(`  → Risk level: ${impactResult.risk.toUpperCase()}`);
  console.log(`  → Affected files: ${impactResult.affectedFiles.length}`);
  impactResult.affectedFiles.forEach(f => {
    console.log(`    - ${f.file} ${f.ui ? `(UI: ${f.ui})` : ''}`);
  });
  console.log(`  → Indirect files: ${impactResult.indirectFiles.length}`);
  console.log(`  → Features affected: ${impactResult.features.join(', ')}`);
  console.log(`  → Rollback time: ${impactResult.rollbackTime}`);
  console.log(`  → Needs approval: ${impactResult.needsApproval}\n`);

  // Step 5: Impact confirm
  console.log(`${CYAN}[Dev]${RESET} Confirm với Founder...`);
  const confirm = await client.callTool({
    name: 'vibeguide_impact_confirm',
    arguments: { filePath: 'src/hooks/useCart.ts', repoPath: repo }
  });
  const confirmResult = JSON.parse(confirm.content[0].text);
  console.log(`  → Downtime ước tính: ${confirmResult.downtime}`);
  console.log(`  → Cần approve: ${confirmResult.needsApproval}`);
  console.log(`  → Affected features: ${confirmResult.affectedFeatures.join(', ')}\n`);

  // Step 6: Test plan
  console.log(`${CYAN}[Dev]${RESET} Generate test plan cho Founder...`);
  const plan = await client.callTool({
    name: 'vibeguide_test_plan',
    arguments: { feature: 'checkout', repoPath: repo }
  });
  const planResult = JSON.parse(plan.content[0].text);
  console.log(`  → Feature: ${planResult.feature}`);
  console.log(`  → Test steps:`);
  planResult.steps.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
  console.log(`  → Expect:`);
  planResult.expect.forEach((e, i) => console.log(`    ${i + 1}. ${e}`));
  console.log();

  // Step 7: Regression
  console.log(`${CYAN}[Dev]${RESET} Check regression sau khi fix...`);
  const regression = await client.callTool({
    name: 'vibeguide_regression',
    arguments: { changedFiles: ['src/hooks/useCart.ts'], repoPath: repo }
  });
  const regResult = JSON.parse(regression.content[0].text);
  console.log(`  → Test flows: ${regResult.testFlows.length}`);
  regResult.testFlows.forEach(f => {
    console.log(`    - ${f.name}: ${f.files.length} files`);
  });
  console.log(`  → All passed: ${regResult.passed}\n`);

  // Step 8: Bug report
  console.log(`${CYAN}[Dev]${RESET} Format bug report...`);
  const report = await client.callTool({
    name: 'vibeguide_bug_report',
    arguments: { description: 'I click the Pay button and nothing happens. The page stays the same.', repoPath: repo }
  });
  const reportResult = JSON.parse(report.content[0].text);
  console.log(`  → Severity: ${reportResult.severity}`);
  console.log(`  → Steps: ${reportResult.steps.length}`);
  reportResult.steps.forEach((s, i) => console.log(`    ${i + 1}. ${s}`));
  console.log();

  await client.close();

  console.log(`${GREEN}✅ SCENARIO COMPLETE${RESET}`);
  console.log(`\n${CYAN}Summary:${RESET}`);
  console.log(`- Found ${bugResult.matches.length} bug patterns in payment-related files`);
  console.log(`- Impact: ${impactResult.risk} risk, ${impactResult.affectedFiles.length} direct + ${impactResult.indirectFiles.length} indirect files`);
  console.log(`- Founder needs to approve ${confirmResult.downtime} downtime`);
  console.log(`- ${planResult.steps.length} test steps generated for founder`);
}

runScenario().catch(e => {
  console.error(`${RED}ERROR:${RESET}`, e.message);
  process.exit(1);
});
