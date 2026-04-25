/** Resolve analyzer import specifiers into repo-relative dependency edges. */
import * as fs from "fs";
import * as path from "path";
import { resolveRustImport } from "./rust/resolve.js";
import type { Language } from "./spi.js";

export interface PathAlias {
  prefix: string;
  target: string;
}

export interface ResolveOptions {
  language?: Language;
  goModule?: string;
}

const JS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue"];
const PYTHON_EXTENSIONS = [".py"];

/** Load TypeScript/JavaScript path aliases from tsconfig or jsconfig. */
export function loadPathAliases(dir: string): PathAlias[] {
  const aliases: PathAlias[] = [];
  for (const configFile of ["tsconfig.json", "jsconfig.json"]) {
    const configPath = path.join(dir, configFile);
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const paths = config?.compilerOptions?.paths;
      const baseUrl = config?.compilerOptions?.baseUrl || ".";
      if (!paths) continue;
      for (const [pattern, targets] of Object.entries(paths) as [string, string[]][]) {
        const prefix = pattern.replace(/\/\*$/, "");
        const target = (targets[0] || "").replace(/\/\*$/, "").replace(/^\.\//, "");
        if (prefix && target) {
          aliases.push({ prefix, target: path.join(baseUrl, target).replace(/\\/g, "/") });
        }
      }
    } catch {
      // No config file or invalid JSON.
    }
  }
  return aliases;
}

/** Read the Go module path from go.mod when present. */
export function loadGoModule(dir: string): string | undefined {
  try {
    const content = fs.readFileSync(path.join(dir, "go.mod"), "utf-8");
    return content.match(/^module\s+(\S+)/m)?.[1];
  } catch {
    return undefined;
  }
}

/** Resolve one import specifier for the language of the importing file. */
export function resolveImportSpecifier(fromFile: string, imported: string, aliases: PathAlias[], baseDir: string, options: ResolveOptions = {}): string | null {
  const language = options.language ?? inferLanguage(fromFile);
  if (language === "python") return resolvePythonImport(fromFile, imported, baseDir);
  if (language === "go") return resolveGoImport(fromFile, imported, baseDir, options.goModule);
  if (language === "rust") return resolveRustImport(fromFile, imported, baseDir);
  return resolveJavaScriptImport(fromFile, imported, aliases, baseDir);
}

function resolveJavaScriptImport(fromFile: string, imported: string, aliases: PathAlias[], baseDir: string): string | null {
  if (imported.startsWith(".")) {
    return resolveImport(fromFile, stripKnownExtension(imported, JS_EXTENSIONS), baseDir, JS_EXTENSIONS, ["index.ts", "index.tsx", "index.js", "index.jsx"]);
  }

  return resolveAliasImport(imported, aliases, baseDir, JS_EXTENSIONS, ["index.ts", "index.tsx", "index.js", "index.jsx"]);
}

function resolvePythonImport(fromFile: string, imported: string, baseDir: string): string | null {
  if (imported.startsWith(".")) {
    return resolveImport(fromFile, imported, baseDir, PYTHON_EXTENSIONS, ["__init__.py"]);
  }
  const modulePath = imported.replace(/\./g, "/");
  return resolvePath(path.resolve(baseDir, modulePath), baseDir, PYTHON_EXTENSIONS, ["__init__.py"]);
}

function resolveGoImport(fromFile: string, imported: string, baseDir: string, goModule?: string): string | null {
  if (imported.startsWith(".")) {
    const fromDir = path.dirname(path.join(baseDir, fromFile));
    return resolveGoPackage(path.resolve(fromDir, imported), baseDir);
  }

  if (!goModule || (imported !== goModule && !imported.startsWith(`${goModule}/`))) {
    return null;
  }

  const packagePath = imported === goModule ? "." : imported.slice(goModule.length + 1);
  return resolveGoPackage(path.resolve(baseDir, packagePath), baseDir);
}

function resolveImport(fromFile: string, importPath: string, baseDir: string, extensions: string[], indexFiles: string[]): string | null {
  const fromDir = path.dirname(path.join(baseDir, fromFile));
  return resolvePath(path.resolve(fromDir, importPath), baseDir, extensions, indexFiles);
}

function resolvePath(resolved: string, baseDir: string, extensions: string[], indexFiles: string[]): string | null {
  if (isFile(resolved)) return toRepoPath(resolved, baseDir);
  for (const ext of extensions) {
    const withExt = resolved + ext;
    if (isFile(withExt)) return toRepoPath(withExt, baseDir);
  }
  if (isDirectory(resolved)) {
    for (const indexFile of indexFiles) {
      const indexPath = path.join(resolved, indexFile);
      if (isFile(indexPath)) return toRepoPath(indexPath, baseDir);
    }
  }
  return null;
}

function resolveAliasImport(imported: string, aliases: PathAlias[], baseDir: string, extensions: string[], indexFiles: string[]): string | null {
  for (const alias of [...aliases].sort((a, b) => b.prefix.length - a.prefix.length)) {
    if (!imported.startsWith(alias.prefix)) continue;
    const relative = imported.slice(alias.prefix.length).replace(/^\//, "");
    return resolvePath(path.join(baseDir, alias.target, relative), baseDir, extensions, indexFiles);
  }
  return null;
}

function resolveGoPackage(packageDir: string, baseDir: string): string | null {
  if (isFile(packageDir)) return toRepoPath(packageDir, baseDir);
  if (!isDirectory(packageDir)) return resolvePath(packageDir, baseDir, [".go"], []);
  const files = fs.readdirSync(packageDir)
    .filter((file) => file.endsWith(".go") && !file.endsWith("_test.go"))
    .sort();
  const preferred = files.find((file) => file === `${path.basename(packageDir)}.go`) ?? files[0];
  return preferred ? toRepoPath(path.join(packageDir, preferred), baseDir) : null;
}

function inferLanguage(filePath: string): Language {
  const ext = path.extname(filePath);
  if ([".ts", ".tsx", ".vue"].includes(ext)) return "typescript";
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(ext)) return "javascript";
  if (ext === ".py") return "python";
  if (ext === ".go") return "go";
  if (ext === ".rs") return "rust";
  return "unknown";
}

function stripKnownExtension(specifier: string, extensions: string[]): string {
  const ext = extensions.find((candidate) => specifier.endsWith(candidate));
  return ext ? specifier.slice(0, -ext.length) : specifier;
}

function isFile(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function isDirectory(filePath: string): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
}

function toRepoPath(filePath: string, baseDir: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, "/");
}
