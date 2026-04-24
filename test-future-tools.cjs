// ============================================================
// VibeGuide Future Tools Test
// Test: snapshot, diff_summary, deploy_check
// ============================================================

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
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
  console.log('=== KHỞI ĐỘNG FUTURE TOOLS TEST ===\n');

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
  });

  const client = new Client({ name: 'future-test', version: '1.0.0' });
  await client.connect(transport);

  const repo = './test-project';
  const packagePath = path.join(repo, 'package.json');
  const tempFilePath = path.join(repo, 'src', 'pages', 'TempAfterSnapshot.tsx');
  const originalPackage = fs.readFileSync(packagePath, 'utf-8');

  // --- TEST 1: snapshot create ---
  console.log(`${CYAN}--- TEST 1: vibeguide_snapshot create ---${RESET}`);
  const snap = await client.callTool({
    name: 'vibeguide_snapshot',
    arguments: { repoPath: repo, action: 'create', label: 'test-snapshot' }
  });
  const snapResult = JSON.parse(snap.content[0].text);
  assert(snapResult.snapshotId && snapResult.snapshotId.length > 0, 'Snapshot có snapshotId');
  assert(snapResult.fileCount > 0, `Snapshot có ${snapResult.fileCount} files`);
  assert(snapResult.label === 'test-snapshot', 'Label đúng');
  console.log(`  → Snapshot ID: ${snapResult.snapshotId}, Files: ${snapResult.fileCount}\n`);

  fs.writeFileSync(packagePath, originalPackage.replace('"version": "1.0.0"', '"version": "1.0.1"'), 'utf-8');
  fs.writeFileSync(tempFilePath, 'export function TempAfterSnapshot() { return null; }\n', 'utf-8');

  // --- TEST 2: snapshot list ---
  console.log(`${CYAN}--- TEST 2: vibeguide_snapshot list ---${RESET}`);
  const list = await client.callTool({
    name: 'vibeguide_snapshot',
    arguments: { repoPath: repo, action: 'list' }
  });
  const listResult = JSON.parse(list.content[0].text);
  assert(Array.isArray(listResult.snapshots), 'List trả về snapshots array');
  assert(listResult.snapshots.length >= 1, `Có ít nhất 1 snapshot (${listResult.snapshots.length})`);
  console.log(`  → Có ${listResult.snapshots.length} snapshot\n`);

  // --- TEST 3: snapshot restore ---
  console.log(`${CYAN}--- TEST 3: vibeguide_snapshot restore ---${RESET}`);
  const restore = await client.callTool({
    name: 'vibeguide_snapshot',
    arguments: { repoPath: repo, action: 'restore', snapshotId: snapResult.snapshotId }
  });
  const restoreResult = JSON.parse(restore.content[0].text);
  assert(restoreResult.restored === true, 'Restore thành công');
  assert(typeof restoreResult.filesChanged === 'number', 'Có filesChanged');
  assert(restoreResult.filesChanged >= 1, 'Restore ghi đè file đã sửa');
  assert(restoreResult.filesDeleted >= 1, 'Restore xóa file mới tạo sau snapshot');
  assert(fs.readFileSync(packagePath, 'utf-8') === originalPackage, 'package.json được khôi phục');
  assert(!fs.existsSync(tempFilePath), 'File mới sau snapshot đã bị xóa');
  console.log(`  → Restored: ${restoreResult.restored}, Files changed: ${restoreResult.filesChanged}, Files deleted: ${restoreResult.filesDeleted}\n`);

  // --- TEST 4: diff_summary since=last ---
  console.log(`${CYAN}--- TEST 4: vibeguide_diff_summary ---${RESET}`);
  const diff = await client.callTool({
    name: 'vibeguide_diff_summary',
    arguments: { repoPath: repo, since: 'last' }
  });
  const diffResult = JSON.parse(diff.content[0].text);
  assert(typeof diffResult.summary === 'string', 'Có summary string');
  assert(Array.isArray(diffResult.filesChanged), 'Có filesChanged array');
  assert(typeof diffResult.riskAssessment === 'string', 'Có riskAssessment');
  assert(diffResult.totalFiles === 0, 'Sau restore không còn diff so với snapshot mới nhất');
  console.log(`  → Summary: ${diffResult.summary}`);
  console.log(`  → Files changed: ${diffResult.filesChanged.length}\n`);

  // --- TEST 5: deploy_check ---
  console.log(`${CYAN}--- TEST 5: vibeguide_deploy_check ---${RESET}`);
  const deploy = await client.callTool({
    name: 'vibeguide_deploy_check',
    arguments: { repoPath: repo }
  });
  const deployResult = JSON.parse(deploy.content[0].text);
  assert(typeof deployResult.passed === 'boolean', 'Có passed boolean');
  assert(Array.isArray(deployResult.checks), 'Có checks array');
  assert(deployResult.checks.length >= 3, `Có ít nhất 3 checks (${deployResult.checks.length})`);
  assert(typeof deployResult.summary === 'string', 'Có summary string');
  deployResult.checks.forEach((c, i) => {
    console.log(`    ${i + 1}. [${c.severity.toUpperCase()}] ${c.name}: ${c.passed ? 'PASS' : 'FAIL'} — ${c.message}`);
  });
  console.log(`  → Summary: ${deployResult.summary}\n`);

  await client.close();

  console.log('='.repeat(50));
  console.log(`${GREEN}PASS: ${passCount}${RESET} | ${RED}FAIL: ${failCount}${RESET}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    console.log(`\n${RED}❌ CÓ LỖI${RESET} — Kiểm tra các test FAIL ở trên`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}✅ TẤT CẢ FUTURE TOOLS TEST PASS${RESET}`);
  }
}

runTests().catch(e => {
  console.error(`${RED}ERROR:${RESET}`, e.message);
  process.exit(1);
});
