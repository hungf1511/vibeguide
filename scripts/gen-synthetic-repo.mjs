#!/usr/bin/env node
/** Generate a synthetic git repo with N TypeScript files and K imports each. */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const args = process.argv.slice(2);
let fileCount = 1000;
let importCount = 3;
let outDir = path.join(process.cwd(), "synthetic-repo");

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--files" && args[i + 1]) fileCount = parseInt(args[i + 1], 10);
  if (args[i] === "--imports" && args[i + 1]) importCount = parseInt(args[i + 1], 10);
  if (args[i] === "--out" && args[i + 1]) outDir = path.resolve(args[i + 1]);
}

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(path.join(outDir, "src"), { recursive: true });

function randInt(max) {
  return Math.floor(Math.random() * max);
}

for (let i = 0; i < fileCount; i++) {
  const fileName = `f${i}.ts`;
  const imports = [];
  for (let k = 0; k < importCount; k++) {
    const target = randInt(fileCount);
    if (target !== i) {
      imports.push(`import { x${target} } from './f${target}';`);
    }
  }
  const content = imports.join("\n") + `\nexport const x${i} = ${i};\n`;
  fs.writeFileSync(path.join(outDir, "src", fileName), content, "utf-8");
}

fs.writeFileSync(path.join(outDir, "package.json"), '{"name":"synthetic","version":"1.0.0"}\n', "utf-8");

execSync("git init -q", { cwd: outDir });
execSync('git config user.email "t@t.com" && git config user.name "t"', { cwd: outDir });
execSync("git add . && git commit -q -m init", { cwd: outDir });

console.log(`Synthetic repo: ${outDir}`);
console.log(`  Files: ${fileCount}`);
console.log(`  Imports per file: ~${importCount}`);
console.log(`  Total imports: ~${imports.length * fileCount}`);
