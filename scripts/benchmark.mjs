#!/usr/bin/env node
import { Bench } from "tinybench";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { scanDependencies } from "../dist/utils/scanner.js";
import { analyzeMonorepo } from "../dist/utils/monorepo.js";
import { createSnapshot } from "../dist/utils/snapshot.js";
import { getLanguageSupport } from "../dist/analyzers/registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const small = path.join(root, "tests/fixtures/small-repo");
const medium = path.join(root, "tests/fixtures/medium/src");
const monorepo = path.join(root, "tests/fixtures/monorepo");

const bench = new Bench({ time: 250 });

bench
  .add("scanDependencies small (2 files)", async () => {
    await scanDependencies(small);
  })
  .add("scanDependencies medium (30 files)", async () => {
    await scanDependencies(medium);
  })
  .add("language support analyzer dispatch", () => {
    getLanguageSupport(root);
  })
  .add("analyzeMonorepo monorepo", () => {
    analyzeMonorepo(monorepo, ["apps/web/index.ts"]);
  })
  .add("createSnapshot small", () => {
    createSnapshot(small, "bench");
  });

await bench.run();

const baseline = bench.tasks.map((task) => ({
  name: task.name,
  meanMs: task.result?.latency.mean ?? null,
  p75Ms: task.result?.latency.p75 ?? null,
}));

const baselinePath = path.join(root, "cache", "baseline.json");
fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), "utf-8");

console.table(baseline);
console.log("Baseline saved to", baselinePath);
