import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { scanDependencies } from "../src/utils/scanner.js";

async function withTempRepo(run: (repo: string) => void | Promise<void>): Promise<void> {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "vibeguide-polyglot-"));
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

describe("polyglot dependency correctness", () => {
  it("keeps Python/Go/Rust graph accuracy above the P2 target on representative fixtures", async () => {
    await withTempRepo(async (repo) => {
      write(repo, "go.mod", "module github.com/acme/shop\n");
        write(repo, "app/routes.py", "from .auth import login\nfrom .models import User\n");
        write(repo, "app/auth.py", "def login(): pass\n");
        write(repo, "app/models.py", "class User: pass\n");
        write(repo, "app/admin.py", "from . import (\n  auth,\n  models as domain_models,\n)\n");
        write(repo, "app/features/checkout.py", "from ..db import session\nfrom ..payments import charge\n");
      write(repo, "app/db.py", "session = object()\n");
      write(repo, "app/payments.py", "def charge(): pass\n");
      write(repo, "cmd/server/main.go", "package main\nimport \"github.com/acme/shop/internal/routes\"\n");
      write(repo, "internal/routes/routes.go", "package routes\nimport \"github.com/acme/shop/internal/handlers\"\n");
      write(repo, "internal/handlers/handlers.go", "package handlers\nfunc Handle() {}\n");
      write(repo, "cmd/worker/main.go", "package main\nimport \"github.com/acme/shop/pkg/jobs\"\n");
      write(repo, "pkg/jobs/jobs.go", "package jobs\nfunc Run() {}\n");
      write(repo, "src/lib.rs", "mod models;\nmod api;\nuse crate::routes::router;\n");
      write(repo, "src/models.rs", "pub struct User;\n");
      write(repo, "src/api/mod.rs", "pub fn mount() {}\n");
      write(repo, "src/routes.rs", "use crate::handlers::{login, logout};\n");
      write(repo, "src/handlers.rs", "pub fn login() {}\npub fn logout() {}\n");

      const expected = [
        "app/routes.py->app/auth.py",
        "app/routes.py->app/models.py",
        "app/admin.py->app/auth.py",
        "app/admin.py->app/models.py",
        "app/features/checkout.py->app/db.py",
        "app/features/checkout.py->app/payments.py",
        "cmd/server/main.go->internal/routes/routes.go",
        "internal/routes/routes.go->internal/handlers/handlers.go",
        "cmd/worker/main.go->pkg/jobs/jobs.go",
        "src/lib.rs->src/models.rs",
        "src/lib.rs->src/api/mod.rs",
        "src/lib.rs->src/routes.rs",
        "src/routes.rs->src/handlers.rs",
      ];

      const actual = new Set((await scanDependencies(repo)).edges.map(edgeKey));
      const hits = expected.filter((edge) => actual.has(edge)).length;
      const accuracy = hits / expected.length;

      expect(accuracy).toBeGreaterThanOrEqual(0.95);
      expect(expected.filter((edge) => !actual.has(edge))).toEqual([]);
    });
  });

  it("uses the tree-sitter Python backend through scanDependencies", async () => {
    const previousBackend = process.env.VIBEGUIDE_PARSER_BACKEND;
    process.env.VIBEGUIDE_PARSER_BACKEND = "tree-sitter";
    try {
      await withTempRepo(async (repo) => {
        write(repo, "app/routes.py", "from .auth import login\nfrom .models import User\n");
        write(repo, "app/auth.py", "def login(): pass\n");
        write(repo, "app/models.py", "class User: pass\n");

        const actual = new Set((await scanDependencies(repo)).edges.map(edgeKey));
        expect(actual).toContain("app/routes.py->app/auth.py");
        expect(actual).toContain("app/routes.py->app/models.py");
      });
    } finally {
      if (previousBackend === undefined) delete process.env.VIBEGUIDE_PARSER_BACKEND;
      else process.env.VIBEGUIDE_PARSER_BACKEND = previousBackend;
    }
  });
});
