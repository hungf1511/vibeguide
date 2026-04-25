/** Phát hiện monorepo manager (npm workspaces, nx, turbo, pnpm) và package bị ảnh hưởng. */
import * as fs from "fs";
import * as path from "path";
import type { MonorepoRouteResult } from "../types.js";
import { normalizePath } from "./scanner.js";

interface PkgInfo {
  name: string;
  path: string;
  dependencies: string[];
}

/** Detect monorepo workspaces and route requests. */
export function analyzeMonorepo(repo: string, changedFiles: string[] = []): MonorepoRouteResult {
  const detected = detectMonorepo(repo);
  if (!detected.isMonorepo) {
    return {
      isMonorepo: false,
      packages: [],
      summary: "Khong phai monorepo. Khong tim thay pnpm-workspace.yaml, lerna.json, nx.json, turbo.json hoac package.json workspaces.",
    };
  }

  const packages = listPackages(repo, detected.workspaceGlobs);
  const pkgByName = new Map<string, PkgInfo>();
  for (const p of packages) pkgByName.set(p.name, p);

  // Build reverse dependency map: which packages depend on which
  const dependents = new Map<string, Set<string>>();
  for (const p of packages) {
    for (const dep of p.dependencies) {
      if (!dependents.has(dep)) dependents.set(dep, new Set());
      dependents.get(dep)!.add(p.name);
    }
  }

  // Map changed files to packages
  const affectedPkgs = new Set<string>();
  for (const cf of changedFiles) {
    const norm = normalizePath(cf);
    for (const p of packages) {
      if (norm.startsWith(p.path + "/") || norm === p.path) {
        affectedPkgs.add(p.name);
      }
    }
  }

  // Propagate to dependents
  const queue = Array.from(affectedPkgs);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dep of dependents.get(cur) || []) {
      if (!affectedPkgs.has(dep)) {
        affectedPkgs.add(dep);
        queue.push(dep);
      }
    }
  }

  const result = packages.map((p) => ({
    name: p.name,
    path: p.path,
    affectedBy: affectedPkgs.has(p.name) ? changedFiles.filter((cf) => normalizePath(cf).startsWith(p.path)).slice(0, 5) : undefined,
  }));

  const summary = changedFiles.length === 0
    ? "Monorepo " + detected.manager + " co " + packages.length + " package."
    : "Thay doi " + changedFiles.length + " file anh huong " + affectedPkgs.size + "/" + packages.length + " package: " + Array.from(affectedPkgs).slice(0, 5).join(", ");

  return {
    isMonorepo: true,
    manager: detected.manager,
    packages: result,
    summary,
  };
}

function detectMonorepo(repo: string): { isMonorepo: boolean; manager?: string; workspaceGlobs: string[] } {
  if (fs.existsSync(path.join(repo, "pnpm-workspace.yaml"))) {
    const content = fs.readFileSync(path.join(repo, "pnpm-workspace.yaml"), "utf-8");
    const globs: string[] = [];
    const re = /-\s*["']?([^"'\n]+)["']?/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) globs.push(m[1].trim());
    return { isMonorepo: true, manager: "pnpm", workspaceGlobs: globs };
  }
  if (fs.existsSync(path.join(repo, "nx.json"))) {
    return { isMonorepo: true, manager: "nx", workspaceGlobs: ["apps/*", "libs/*", "packages/*"] };
  }
  if (fs.existsSync(path.join(repo, "turbo.json"))) {
    const pkg = readPkg(repo);
    const ws = pkg?.workspaces;
    const globs = Array.isArray(ws) ? (ws as string[]) : (typeof ws === "object" && ws !== null && "packages" in ws && Array.isArray((ws as Record<string, unknown>).packages) ? (ws as Record<string, unknown>).packages as string[] : ["apps/*", "packages/*"]);
    return { isMonorepo: true, manager: "turbo", workspaceGlobs: globs };
  }
  if (fs.existsSync(path.join(repo, "lerna.json"))) {
    const lerna = JSON.parse(fs.readFileSync(path.join(repo, "lerna.json"), "utf-8")) as Record<string, unknown>;
    return { isMonorepo: true, manager: "lerna", workspaceGlobs: Array.isArray(lerna.packages) ? lerna.packages as string[] : ["packages/*"] };
  }
  const pkg = readPkg(repo);
  const ws = pkg?.workspaces;
  if (ws && (Array.isArray(ws) || (typeof ws === "object" && ws !== null && "packages" in ws))) {
    const globs = Array.isArray(ws) ? (ws as string[]) : ((ws as Record<string, unknown>).packages as string[] || []);
    return { isMonorepo: true, manager: "yarn-workspaces", workspaceGlobs: globs };
  }
  return { isMonorepo: false, workspaceGlobs: [] };
}

function readPkg(repo: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf-8"));
  } catch { return null; }
}

function listPackages(repo: string, globs: string[]): PkgInfo[] {
  const packages: PkgInfo[] = [];
  for (const glob of globs) {
    const stripped = glob.replace(/\/\*$/, "");
    const baseDir = path.join(repo, stripped);
    if (!fs.existsSync(baseDir)) continue;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(baseDir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const pkgJson = path.join(baseDir, e.name, "package.json");
      if (!fs.existsSync(pkgJson)) continue;
      try {
        const data = JSON.parse(fs.readFileSync(pkgJson, "utf-8"));
        const internal = Object.keys(data.dependencies || {}).concat(Object.keys(data.devDependencies || {}));
        packages.push({
          name: data.name || e.name,
          path: normalizePath(path.relative(repo, path.join(baseDir, e.name))),
          dependencies: internal,
        });
      } catch { /* ignore */ }
    }
  }
  return packages;
}