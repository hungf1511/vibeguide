import { performance } from "perf_hooks";
import { parseWithTreeSitter, getLoadedTreeSitterGrammars } from "../dist/analyzers/treeSitterRuntime.js";

console.log("Loaded grammars before:", getLoadedTreeSitterGrammars());

const start = performance.now();
await parseWithTreeSitter("go", 'package main\nimport "fmt"', [], () => []);
const elapsed = performance.now() - start;

console.log("Cold-start Go grammar:", elapsed.toFixed(2), "ms");
console.log("Loaded grammars after:", getLoadedTreeSitterGrammars());

if (elapsed > 500) {
  console.error("FAIL: cold-start exceeds 500ms budget");
  process.exit(1);
} else {
  console.log("PASS: cold-start within 500ms budget");
}