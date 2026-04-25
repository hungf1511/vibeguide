import { describe, it, expect } from "vitest";
import * as path from "path";
import { goAnalyzer, goTreeSitterAnalyzer } from "../src/analyzers/go/index.js";
import { javascriptAnalyzer, typescriptAnalyzer } from "../src/analyzers/javascript/staticAnalyzer.js";
import { javascriptTreeSitterAnalyzer, typescriptTreeSitterAnalyzer } from "../src/analyzers/javascript/treeSitterAnalyzer.js";
import { pythonAnalyzer, pythonTreeSitterAnalyzer } from "../src/analyzers/python/index.js";
import { getAnalyzerForFile, getLanguageSupport } from "../src/analyzers/registry.js";
import { rustAnalyzer, rustTreeSitterAnalyzer } from "../src/analyzers/rust/index.js";
import { getLoadedTreeSitterGrammars } from "../src/analyzers/treeSitterRuntime.js";
import type { Analyzer, SourceFile } from "../src/analyzers/spi.js";

function source(filePath: string, content: string): SourceFile {
  return {
    path: filePath,
    absolutePath: path.resolve(filePath),
    extension: path.extname(filePath),
    content,
  };
}

async function specifiers(analyzer: Analyzer, filePath: string, content: string): Promise<string[]> {
  return (await analyzer.parseImports(source(filePath, content))).map((item) => item.specifier);
}

describe("analyzer registry", () => {
  it("dispatches by extension and reports supported languages", () => {
    expect(getAnalyzerForFile("src/app.ts")?.language).toBe("typescript");
    expect(getAnalyzerForFile("src/app.js")?.language).toBe("javascript");
    expect(getAnalyzerForFile("app.py")).toBe(pythonTreeSitterAnalyzer);
    expect(getAnalyzerForFile("app.py", "", { backend: "tree-sitter" })).toBe(pythonTreeSitterAnalyzer);
    expect(getAnalyzerForFile("main.go")).toBe(goTreeSitterAnalyzer);
    expect(getAnalyzerForFile("lib.rs")).toBe(rustTreeSitterAnalyzer);
    expect(getAnalyzerForFile("README.md")).toBeNull();
    expect(getLanguageSupport().map((item) => item.language)).toEqual([
      "typescript",
      "javascript",
      "python",
      "go",
      "rust",
    ]);
    expect(getLanguageSupport(undefined, { backend: "tree-sitter" }).find((item) => item.language === "python")?.strategy).toBe("tree-sitter-wasm");
    expect(getLanguageSupport(undefined, { backend: "tree-sitter" }).every((item) => item.strategy === "tree-sitter-wasm")).toBe(true);
    expect(getLoadedTreeSitterGrammars()).toEqual([]);
  });
});

describe("golden import parsing", () => {
  it("keeps JS and TS static parser parity across common import forms", async () => {
    const content = [
      "import a from './a';",
      "import { b } from './b';",
      "import * as c from './c';",
      "import './side-effect';",
      "const d = require('./d');",
      "const e = await import('./e');",
      "export { f } from './f';",
      "export * from './g';",
      "import h, { i } from './h';",
      "import type { J } from './j';",
      "import k = require('./k');",
      "const l = require('./l.json');",
      "const m = import('./m');",
      "export { n as renamed } from './n';",
      "import o from '@/o';",
      "import p from 'pkg/p';",
      "import q from './q.js';",
      "import r from '../r';",
      "import s from './s/index';",
      "export * as t from './t';",
    ].join("\n");
    const expected = ["./a", "./b", "./c", "./side-effect", "./d", "./e", "./f", "./g", "./h", "./j", "./k", "./l.json", "./m", "./n", "@/o", "pkg/p", "./q.js", "../r", "./s/index", "./t"];
    expect(await specifiers(typescriptAnalyzer, "src/app.ts", content)).toEqual(expected);
    expect(await specifiers(javascriptAnalyzer, "src/app.js", content)).toEqual(expected);
  });

  it("parses JS and TS imports through the tree-sitter backend", async () => {
    const tsContent = [
      "import a from './a';",
      "import { b } from './b';",
      "import * as c from './c';",
      "import './side-effect';",
      "const d = require('./d');",
      "const e = await import('./e');",
      "export { f } from './f';",
      "export * from './g';",
      "import h, { i } from './h';",
      "import type { J } from './j';",
      "import k = require('./k');",
      "const l = require('./l.json');",
      "const m = import('./m');",
      "export { n as renamed } from './n';",
      "import o from '@/o';",
      "import p from 'pkg/p';",
      "import q from './q.js';",
      "import r from '../r';",
      "import s from './s/index';",
      "export * as t from './t';",
    ].join("\n");
    expect(await specifiers(typescriptTreeSitterAnalyzer, "src/app.ts", tsContent)).toEqual([
      "./a", "./b", "./c", "./side-effect", "./d", "./e", "./f", "./g", "./h", "./j", "./k", "./l.json", "./m", "./n", "@/o", "pkg/p", "./q.js", "../r", "./s/index", "./t",
    ]);

    const jsContent = tsContent
      .replace("import type { J } from './j';\n", "")
      .replace("import k = require('./k');\n", "");
    expect(await specifiers(javascriptTreeSitterAnalyzer, "src/app.js", jsContent)).toEqual([
      "./a", "./b", "./c", "./side-effect", "./d", "./e", "./f", "./g", "./h", "./l.json", "./m", "./n", "@/o", "pkg/p", "./q.js", "../r", "./s/index", "./t",
    ]);
  });

  it("parses Python imports and relative from-imports", async () => {
    const content = [
      "import os",
      "import sys as system",
      "import package.alpha, package.beta as beta",
      "from package.gamma import Thing",
      "from package.delta.sub import value as renamed",
      "from . import local_a, local_b",
      "from .local_c import item",
      "from ..parent import parent_item",
      "from ..parent.child import child_item",
      "from services.api import Client",
      "from services.auth import login",
      "from models.user import User",
      "from models.order import Order",
      "import app.config",
      "import app.routes",
      "import app.views",
      "import app.tasks",
      "import app.db",
      "import app.cache",
      "import app.mail",
    ].join("\n");
    expect(await specifiers(pythonAnalyzer, "app/main.py", content)).toEqual([
      "os", "sys", "package.alpha", "package.beta", "app.config", "app.routes", "app.views", "app.tasks", "app.db", "app.cache", "app.mail",
      "package.gamma", "package.delta.sub", "./local_a", "./local_b", "./local_c", "../parent", "../parent/child", "services.api", "services.auth", "models.user", "models.order",
    ]);
  });

  it("parses Python imports through the tree-sitter backend", async () => {
    const content = [
      "import os",
      "import sys as system",
      "import package.alpha, package.beta as beta",
      "from package.gamma import Thing",
      "from package.delta.sub import value as renamed",
      "from . import local_a, local_b",
      "from . import (",
      "  multi_a,",
      "  multi_b as renamed_multi,",
      ")",
      "from .local_c import item",
      "from ..parent import parent_item",
      "from ..parent.child import child_item",
      "from services.api import Client",
      "from services.auth import login",
      "from models.user import User",
      "from models.order import Order",
      "import app.config",
      "import app.routes",
      "import app.views",
      "import app.tasks",
      "import app.db",
      "import app.cache",
      "import app.mail",
    ].join("\n");
    expect(await specifiers(pythonTreeSitterAnalyzer, "app/main.py", content)).toEqual([
      "os", "sys", "package.alpha", "package.beta", "package.gamma", "package.delta.sub", "./local_a", "./local_b", "./multi_a", "./multi_b", "./local_c", "../parent", "../parent/child", "services.api", "services.auth", "models.user", "models.order", "app.config", "app.routes", "app.views", "app.tasks", "app.db", "app.cache", "app.mail",
    ]);
  });

  it("parses Go single and block imports", async () => {
    const content = [
      "package main",
      'import "fmt"',
      "import (",
      '  "context"',
      '  http "net/http"',
      '  _ "embed"',
      '  . "strings"',
      '  "example.com/app/pkg/a"',
      '  "example.com/app/pkg/b"',
      '  "example.com/app/pkg/c"',
      '  "example.com/app/pkg/d"',
      '  "example.com/app/pkg/e"',
      '  "example.com/app/pkg/f"',
      '  "example.com/app/pkg/g"',
      '  "example.com/app/pkg/h"',
      '  "example.com/app/pkg/i"',
      '  "example.com/app/pkg/j"',
      '  "example.com/app/pkg/k"',
      '  "example.com/app/pkg/l"',
      '  "example.com/app/pkg/m"',
      '  "example.com/app/pkg/n"',
      '  "example.com/app/pkg/o"',
      ")",
    ].join("\n");
    const expectedStaticOrder = [
      "context", "net/http", "embed", "strings", "example.com/app/pkg/a", "example.com/app/pkg/b", "example.com/app/pkg/c", "example.com/app/pkg/d", "example.com/app/pkg/e", "example.com/app/pkg/f", "example.com/app/pkg/g", "example.com/app/pkg/h", "example.com/app/pkg/i", "example.com/app/pkg/j", "example.com/app/pkg/k", "example.com/app/pkg/l", "example.com/app/pkg/m", "example.com/app/pkg/n", "example.com/app/pkg/o", "fmt",
    ];
    const expectedSourceOrder = [
      "fmt", "context", "net/http", "embed", "strings", "example.com/app/pkg/a", "example.com/app/pkg/b", "example.com/app/pkg/c", "example.com/app/pkg/d", "example.com/app/pkg/e", "example.com/app/pkg/f", "example.com/app/pkg/g", "example.com/app/pkg/h", "example.com/app/pkg/i", "example.com/app/pkg/j", "example.com/app/pkg/k", "example.com/app/pkg/l", "example.com/app/pkg/m", "example.com/app/pkg/n", "example.com/app/pkg/o",
    ];
    expect(await specifiers(goAnalyzer, "main.go", content)).toEqual(expectedStaticOrder);
    expect(await specifiers(goTreeSitterAnalyzer, "main.go", content)).toEqual(expectedSourceOrder);
  });


  it("parses Go exported identifiers through tree-sitter", async () => {
    const content = [
      "package main",
      "func PublicFunc() {}",
      "func privateFunc() {}",
      "type PublicType struct{}",
      "type privateType struct{}",
      "var PublicVar int",
      "var privateVar int",
      "const PublicConst = 1",
      "const privateConst = 2",
      "func init() {}",
      "func main() {}",
    ].join("\n");
    const exports = await goTreeSitterAnalyzer.parseExports(source("main.go", content));
    const names = exports.map((e) => e.name);
    expect(names).toEqual(["PublicFunc", "PublicType", "PublicVar", "PublicConst"]);
  });
  it("parses Rust local modules and crate-relative uses", async () => {
    const content = [
      "mod config;",
      "pub mod routes;",
      "use crate::models::User;",
      "use crate::services::auth::login;",
      "use crate::services::billing::{Invoice, Payment};",
      "use crate::db::Pool;",
      "use crate::cache::Store;",
      "use crate::mail::Sender;",
      "use crate::jobs::Runner;",
      "use crate::api::router;",
      "use crate::ui::Button;",
      "use crate::ui::Link;",
      "use crate::state::AppState;",
      "use crate::errors::AppError;",
      "use crate::config::Settings;",
      "use crate::metrics::Recorder;",
      "use crate::logging::init;",
      "use crate::features::flags;",
      "use crate::security::csrf;",
      "use crate::utils::slug;",
      "use super::parent_mod;",
      "use self::child_mod;",
      "use serde::Serialize;",
    ].join("\n");
    const expected = [
      "./config", "./routes", "crate::models::User", "crate::services::auth::login", "crate::services::billing::Invoice", "crate::services::billing::Payment", "crate::db::Pool", "crate::cache::Store", "crate::mail::Sender", "crate::jobs::Runner", "crate::api::router", "crate::ui::Button", "crate::ui::Link", "crate::state::AppState", "crate::errors::AppError", "crate::config::Settings", "crate::metrics::Recorder", "crate::logging::init", "crate::features::flags", "crate::security::csrf", "crate::utils::slug", "super::parent_mod", "self::child_mod",
    ];
    expect(await specifiers(rustAnalyzer, "src/lib.rs", content)).toEqual(expected);
    expect(await specifiers(rustTreeSitterAnalyzer, "src/lib.rs", content)).toEqual(expected);
  });
});