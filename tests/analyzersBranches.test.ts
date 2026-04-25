import { describe, it, expect } from "vitest";
import { javascriptTreeSitterAnalyzer, typescriptTreeSitterAnalyzer } from "../src/analyzers/javascript/treeSitterAnalyzer.js";
import { rustTreeSitterAnalyzer } from "../src/analyzers/rust/treeSitterAnalyzer.js";

describe("JS/TS treeSitter edge cases", () => {
  it("parses require call", async () => {
    const refs = await javascriptTreeSitterAnalyzer.parseImports({ path: "a.js", absolutePath: "/a.js", content: `const x = require("./mod");`, extension: ".js" });
    expect(refs.map((r) => r.specifier)).toContain("./mod");
    expect(refs.find((r) => r.specifier === "./mod")?.kind).toBe("require");
  });

  it("parses dynamic import", async () => {
    const refs = await javascriptTreeSitterAnalyzer.parseImports({ path: "a.js", absolutePath: "/a.js", content: `const x = await import("./mod");`, extension: ".js" });
    expect(refs.map((r) => r.specifier)).toContain("./mod");
    expect(refs.find((r) => r.specifier === "./mod")?.kind).toBe("dynamic");
  });

  it("parses export class", async () => {
    const refs = await javascriptTreeSitterAnalyzer.parseExports({ path: "a.js", absolutePath: "/a.js", content: `export class Bar {}`, extension: ".js" });
    expect(refs.map((r) => r.name)).toContain("Bar");
  });

  it("parses export function", async () => {
    const refs = await javascriptTreeSitterAnalyzer.parseExports({ path: "a.js", absolutePath: "/a.js", content: `export function foo() {}`, extension: ".js" });
    expect(refs.map((r) => r.name)).toContain("foo");
  });

  it("parses export named clause", async () => {
    const refs = await javascriptTreeSitterAnalyzer.parseExports({ path: "a.js", absolutePath: "/a.js", content: `export { a, b };`, extension: ".js" });
    expect(refs.map((r) => r.name)).toContain("b");
  });

  it("parses TSX file", async () => {
    const refs = await typescriptTreeSitterAnalyzer.parseImports({ path: "a.tsx", absolutePath: "/a.tsx", content: `import a from "./a";`, extension: ".tsx" });
    expect(Array.isArray(refs)).toBe(true);
  });

  it("falls back for .vue files", async () => {
    const refs = await typescriptTreeSitterAnalyzer.parseImports({ path: "a.vue", absolutePath: "/a.vue", content: `import a from "./a";`, extension: ".vue" });
    expect(Array.isArray(refs)).toBe(true);
  });
});

describe("Rust treeSitter edge cases", () => {
  it("parses mod item", async () => {
    const refs = await rustTreeSitterAnalyzer.parseImports({ path: "a.rs", absolutePath: "/a.rs", content: `mod config;`, extension: ".rs" });
    expect(refs.map((r) => r.specifier)).toContain("./config");
  });

  it("parses use crate path", async () => {
    const refs = await rustTreeSitterAnalyzer.parseImports({ path: "a.rs", absolutePath: "/a.rs", content: `use crate::models::User;`, extension: ".rs" });
    expect(refs.map((r) => r.specifier)).toContain("crate::models::User");
  });

  it("parses braced use", async () => {
    const refs = await rustTreeSitterAnalyzer.parseImports({ path: "a.rs", absolutePath: "/a.rs", content: `use crate::models::{User, Order};`, extension: ".rs" });
    expect(refs.map((r) => r.specifier)).toContain("crate::models::User");
    expect(refs.map((r) => r.specifier)).toContain("crate::models::Order");
  });

  it("parses self in braced use", async () => {
    const refs = await rustTreeSitterAnalyzer.parseImports({ path: "a.rs", absolutePath: "/a.rs", content: `use crate::models::{self, User};`, extension: ".rs" });
    expect(refs.map((r) => r.specifier)).toContain("crate::models");
  });
});
