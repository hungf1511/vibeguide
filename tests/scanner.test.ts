import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { normalizePath, getAllSourceFiles, scanDependencies } from "../src/utils/scanner.js";
import { legacyJavaScriptAnalyzer } from "../src/analyzers/javascript/legacyAnalyzer.js";
import type { SourceFile } from "../src/analyzers/spi.js";

const FIXTURE = path.resolve("tests/fixtures/small-repo");

async function withTempRepo(run: (repo: string) => void | Promise<void>): Promise<void> {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "vibeguide-scanner-"));
  try {
    await run(repo);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

function write(repo: string, rel: string, content: string): void {
  const full = path.join(repo, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf-8");
}

function edgeKey(edge: { from: string; to: string }): string {
  return `${edge.from}->${edge.to}`;
}

describe("scanner", () => {
  describe("normalizePath", () => {
    it("converts backslashes to forward slashes", () => {
      const input = "src" + "\\" + "utils" + "\\" + "file.ts";
      expect(normalizePath(input)).toBe("src/utils/file.ts");
    });

    it("leaves forward slashes alone", () => {
      expect(normalizePath("src/utils/file.ts")).toBe("src/utils/file.ts");
    });
  });

  describe("getAllSourceFiles", () => {
    it("lists TS files in fixture", () => {
      const files = getAllSourceFiles(FIXTURE);
      const names = files.map((f) => path.basename(f)).sort();
      expect(names).toEqual(["helper.ts", "index.ts"]);
    });
  });

  describe("scanDependencies", () => {
    it("finds import edge between helper and index", async () => {
      const graph = await scanDependencies(FIXTURE);
      const edges = graph.edges;
      const importEdge = edges.find((e) => e.from === "helper.ts" && e.to === "index.ts");
      expect(importEdge).toBeDefined();
    });

    it("includes both files as nodes", async () => {
      const graph = await scanDependencies(FIXTURE);
      expect(graph.nodes).toContain("index.ts");
      expect(graph.nodes).toContain("helper.ts");
    });

    it("keeps legacy import parser parity for JS and TS import forms", async () => {
      await withTempRepo(async (repo) => {
        write(repo, "tsconfig.json", JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/*": ["src/*"],
            },
          },
        }));
        write(repo, "src/index.ts", [
          "import { util } from './util';",
          "const cjs = require('./cjs');",
          "const dynamic = import('./dynamic');",
          "export { reexported } from './reexport';",
          "export * from './star';",
          "import Button from '@/components/Button';",
          "import external from 'external-package';",
          "export const value = util + cjs + dynamic + Button + external;",
        ].join("\n"));
        write(repo, "src/util.ts", "export const util = 1;\n");
        write(repo, "src/cjs.ts", "export const cjs = 1;\n");
        write(repo, "src/dynamic.ts", "export const dynamic = 1;\n");
        write(repo, "src/reexport.ts", "export const reexported = 1;\n");
        write(repo, "src/star.ts", "export const star = 1;\n");
        write(repo, "src/components/Button/index.tsx", "export default function Button() { return null; }\n");

        const graph = await scanDependencies(repo);
        const edges = new Set(graph.edges.map(edgeKey));

        expect(edges).toEqual(new Set([
          "src/index.ts->src/util.ts",
          "src/index.ts->src/cjs.ts",
          "src/index.ts->src/dynamic.ts",
          "src/index.ts->src/reexport.ts",
          "src/index.ts->src/star.ts",
          "src/index.ts->src/components/Button/index.tsx",
        ]));
      });
    });

    it("builds dependency edges for Python, Go, and Rust files", async () => {
      await withTempRepo(async (repo) => {
        write(repo, "go.mod", "module example.com/app\n");
        write(repo, "src/app.py", "from . import utils\nimport src.lib\n");
        write(repo, "src/utils.py", "def helper(): pass\n");
        write(repo, "src/lib.py", "VALUE = 1\n");
        write(repo, "cmd/main.go", "package main\nimport \"example.com/app/pkg/service\"\n");
        write(repo, "pkg/service/service.go", "package service\nfunc Run() {}\n");
        write(repo, "src/lib.rs", "mod config;\nuse crate::models::User;\n");
        write(repo, "src/config.rs", "pub const PORT: u16 = 3000;\n");
        write(repo, "src/models.rs", "pub struct User;\n");

        const graph = await scanDependencies(repo);
        const edges = new Set(graph.edges.map(edgeKey));

        expect(edges).toEqual(new Set([
          "src/app.py->src/utils.py",
          "src/app.py->src/lib.py",
          "cmd/main.go->pkg/service/service.go",
          "src/lib.rs->src/config.rs",
          "src/lib.rs->src/models.rs",
        ]));
      });
    });

    it("supports legacy parser mode for one-minor rollback compatibility", async () => {
      await withTempRepo(async (repo) => {
        write(repo, "src/index.ts", "import { util } from './util';\n");
        write(repo, "src/util.ts", "export const util = 1;\n");
        write(repo, "src/app.py", "from . import helper\n");
        write(repo, "src/helper.py", "VALUE = 1\n");

        const previous = process.env.VIBEGUIDE_LEGACY_PARSER;
        process.env.VIBEGUIDE_LEGACY_PARSER = "1";
        try {
          const edges = new Set((await scanDependencies(repo)).edges.map(edgeKey));
          expect(edges).toEqual(new Set(["src/index.ts->src/util.ts"]));
        } finally {
          if (previous === undefined) delete process.env.VIBEGUIDE_LEGACY_PARSER;
          else process.env.VIBEGUIDE_LEGACY_PARSER = previous;
        }
      });
    });
  });

  describe("legacyJavaScriptAnalyzer", () => {
    it("extracts import kinds and named exports", () => {
      const file: SourceFile = {
        path: "src/index.ts",
        absolutePath: path.resolve("src/index.ts"),
        extension: ".ts",
        content: [
          "import x from './x';",
          "const y = await import('./y');",
          "const z = require('./z');",
          "export { a as renamed } from './a';",
          "export function greet() {}",
          "export const answer = 42;",
        ].join("\n"),
      };

      expect(legacyJavaScriptAnalyzer.detect(file.path)).toBe(true);
      expect(legacyJavaScriptAnalyzer.parseImports(file)).toEqual([
        { specifier: "./x", kind: "static" },
        { specifier: "./y", kind: "dynamic" },
        { specifier: "./z", kind: "require" },
        { specifier: "./a", kind: "re-export" },
      ]);
      expect(legacyJavaScriptAnalyzer.parseExports(file).map((item) => item.name)).toEqual([
        "renamed",
        "greet",
        "answer",
      ]);
    });
  });
});
