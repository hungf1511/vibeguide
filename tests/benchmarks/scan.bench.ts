import { Bench } from "tinybench";
import * as path from "path";
import { fileURLToPath } from "url";
import { scanDependencies } from "../../src/utils/scanner.js";
import { analyzeMonorepo } from "../../src/utils/monorepo.js";
import { createSnapshot, restoreSnapshot } from "../../src/utils/snapshot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SMALL = path.resolve(__dirname, "../fixtures/small-repo");
const MEDIUM = path.resolve(__dirname, "../fixtures/medium/src");
const MONO = path.resolve(__dirname, "../fixtures/monorepo");

const bench = new Bench({ time: 1000 });

bench
  .add("scanDependencies small (2 files)", () => {
    scanDependencies(SMALL);
  })
  .add("scanDependencies medium (30 files)", () => {
    scanDependencies(MEDIUM);
  })
  .add("analyzeMonorepo monorepo", () => {
    analyzeMonorepo(MONO, ["apps/web/index.ts"]);
  })
  .add("createSnapshot small", () => {
    createSnapshot(SMALL, "bench");
  })
  // Note: createSnapshot on self is excluded due to BN3 (snapshot full-content blowup)
  // .add("createSnapshot self (49 files)", () => {
  //   createSnapshot(REPO_ROOT, "self-bench");
  // });

async function main() {
  await bench.run();

  console.table(bench.table());

  // Save baseline
  const fs = await import("fs");
  const baselinePath = path.resolve(__dirname, "../../cache/baseline.json");
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  const baseline = bench.tasks.map((t) => ({
    name: t.name,
    meanMs: t.result?.mean ? t.result.mean * 1000 : null,
    p75Ms: t.result?.p75 ? t.result.p75 * 1000 : null,
  }));
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), "utf-8");
  console.log("Baseline saved to", baselinePath);
}

main();
