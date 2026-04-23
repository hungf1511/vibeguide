// ============================================================
// VibeGuide Batch 2 Test: suggest_fix, changelog, dependency_graph
// ============================================================

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  console.log(`${CYAN}=== BATCH 2 TEST ===${RESET}\n`);

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp/server.js'],
  });

  const client = new Client({ name: 'batch2-test', version: '1.0.0' });
  await client.connect(transport);

  const repo = '.';

  // --- TEST suggest_fix ---
  console.log(`${CYAN}[TEST]${RESET} vibeguide_suggest_fix (any-type at src/hooks/useCart.ts:6)`);
  const fix = await client.callTool({
    name: 'vibeguide_suggest_fix',
    arguments: { filePath: 'src/hooks/useCart.ts', patternId: 'any-type', line: 6, repoPath: 'C:/Users/User/vibeguide-test-project' }
  });
  const fixResult = JSON.parse(fix.content[0].text);
  assert(fixResult.suggestions && fixResult.suggestions.length > 0, 'Có ít nhất 1 suggestion');
  const sug = fixResult.suggestions[0];
  assert(sug.original.includes('any'), 'Original chứa any');
  assert(sug.fixed.includes('unknown'), 'Fixed thay any bằng unknown');
  assert(sug.explanation.includes('any') || sug.explanation.includes('unknown'), 'Explanation liên quan');
  console.log(`  ✓ Suggestion: ${sug.fixed.trim()}`);
  console.log(`  ✓ Explanation: ${sug.explanation}\n`);

  // --- TEST changelog ---
  console.log(`${CYAN}[TEST]${RESET} vibeguide_changelog (count=10)`);
  const cl = await client.callTool({
    name: 'vibeguide_changelog',
    arguments: { repoPath: repo, count: 10 }
  });
  const clResult = JSON.parse(cl.content[0].text);
  assert(typeof clResult.raw === 'string', 'Có raw changelog');
  assert(clResult.sections, 'Có sections');
  assert(typeof clResult.version === 'string', 'Có version');
  console.log(`  ✓ Sections: ${clResult.sections.length}`);
  console.log(`  ✓ Raw length: ${clResult.raw.length} chars\n`);

  // --- TEST dependency_graph (mermaid) ---
  console.log(`${CYAN}[TEST]${RESET} vibeguide_dependency_graph (mermaid)`);
  const dg = await client.callTool({
    name: 'vibeguide_dependency_graph',
    arguments: { repoPath: repo, format: 'mermaid' }
  });
  const dgResult = JSON.parse(dg.content[0].text);
  assert(typeof dgResult.mermaid === 'string', 'Có mermaid string');
  assert(dgResult.mermaid.includes('graph TD'), 'Mermaid có graph TD');
  assert(typeof dgResult.nodes === 'number', 'Có nodes count');
  assert(typeof dgResult.edges === 'number', 'Có edges count');
  console.log(`  ✓ Nodes: ${dgResult.nodes}, Edges: ${dgResult.edges}`);
  console.log(`  ✓ Mermaid snippet: ${dgResult.mermaid.slice(0, 80).replace(/\n/g, ' ')}...\n`);

  await client.close();

  console.log(`${GREEN}✅ BATCH 2 ALL PASS${RESET}`);
}

run().catch(e => {
  console.error(`${RED}❌ FAIL:${RESET}`, e.message);
  process.exit(1);
});
