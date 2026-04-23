#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import {
  handleHeuristicBug,
  handleDeployCheck,
} from "../dist/mcp/handlers/handlers.js";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

async function run() {
  console.log(`${YELLOW}🔍 VibeGuide self-check on itself...${RESET}\n`);

  const bugResult = await handleHeuristicBug({
    repoPath: repo,
    symptom: "potential bugs in vibeguide",
  });
  console.log(
    `Bug patterns: ${bugResult.matches?.length || 0} found`
  );
  if (bugResult.matches?.length > 0) {
    for (const m of bugResult.matches) {
      console.log(
        `  ${RED}✗${RESET} ${m.pattern} at ${m.file}:${m.line || "?"} (score: ${m.score})`
      );
    }
  }

  const deployResult = await handleDeployCheck({ repoPath: repo, checkUncommitted: false });
  console.log(
    `Deploy check: ${deployResult.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`}`
  );
  for (const c of deployResult.checks) {
    const icon = c.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon} [${c.severity.toUpperCase()}] ${c.name}: ${c.message}`);
  }

  const issues = (bugResult.matches?.length || 0) + deployResult.checks.filter(c => !c.passed).length;

  if (issues > 0) {
    console.log(
      `\n${RED}❌ Self-check FAILED — ${issues} issue(s). Fix before commit.${RESET}`
    );
    process.exit(1);
  }

  console.log(`\n${GREEN}✅ Self-check PASSED — VibeGuide is clean.${RESET}`);
}

run().catch((err) => {
  console.error(`${RED}CRASH:${RESET}`, err.message);
  process.exit(1);
});
