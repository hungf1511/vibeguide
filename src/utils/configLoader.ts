import * as fs from "fs";
import * as path from "path";

export interface VibeguideConfig {
  framework: string;
  ignorePatterns: string[];
  entryPoints: Record<string, string[]>;
  aliases: Record<string, string>;
  scan: {
    incremental: boolean;
    parallel: boolean;
    maxDepth: number;
  };
  thresholds: {
    bugPatterns: { critical: number; high: number; medium: number };
    orphanFiles: number;
    contextBudget: number;
  };
  security: {
    scanDependencies: boolean;
    owaspTop10: boolean;
    hardcodedSecrets: string[];
  };
  vulnerability: {
    checkNpmAudit: boolean;
    severity: string;
  };
  criticalFeatures: string[];
  language: "vi" | "en";
  outputFormat: "json" | "markdown" | "text";
  severityThresholds: {
    deployBlock: "critical" | "high" | "medium";
    needsApproval: "critical" | "high" | "medium";
  };
}

const DEFAULT_CONFIG: VibeguideConfig = {
  framework: "auto",
  ignorePatterns: [],
  entryPoints: {
    nextjs: ["page.tsx", "page.ts", "page.jsx", "page.js", "layout.tsx", "layout.ts", "layout.jsx", "layout.js", "route.ts", "route.tsx"],
    remix: ["route.tsx", "route.ts", "route.jsx", "route.js"],
    nuxt: ["pages/**/*.vue", "app.vue"],
    generic: ["index.tsx", "index.ts", "index.jsx", "index.js", "App.tsx", "App.ts", "App.jsx", "App.js", "main.tsx", "main.ts", "main.jsx", "main.js"],
  },
  aliases: {},
  scan: { incremental: true, parallel: true, maxDepth: 10 },
  thresholds: { bugPatterns: { critical: 0, high: 3, medium: 10 }, orphanFiles: 10, contextBudget: 4000 },
  security: { scanDependencies: true, owaspTop10: true, hardcodedSecrets: ["password", "secret", "token", "api_key", "private_key", "access_key"] },
  vulnerability: { checkNpmAudit: true, severity: "moderate" },
  criticalFeatures: ["Thanh toán", "Giỏ hàng", "Đăng nhập", "Xác thực", "Payment", "Checkout", "Cart", "Login", "Auth"],
  language: "vi",
  outputFormat: "json",
  severityThresholds: { deployBlock: "critical", needsApproval: "high" },
};

export function loadConfig(repo: string): VibeguideConfig {
  const configPath = path.join(repo, ".vibeguide.json");
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(content);
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  } catch {
    return DEFAULT_CONFIG;
  }
}

function mergeConfig(base: VibeguideConfig, override: Partial<VibeguideConfig>): VibeguideConfig {
  return {
    framework: override.framework ?? base.framework,
    ignorePatterns: override.ignorePatterns ?? base.ignorePatterns,
    entryPoints: { ...base.entryPoints, ...(override.entryPoints || {}) },
    aliases: { ...base.aliases, ...(override.aliases || {}) },
    scan: { ...base.scan, ...(override.scan || {}) },
    thresholds: {
      bugPatterns: { ...base.thresholds.bugPatterns, ...(override.thresholds?.bugPatterns || {}) },
      orphanFiles: override.thresholds?.orphanFiles ?? base.thresholds.orphanFiles,
      contextBudget: override.thresholds?.contextBudget ?? base.thresholds.contextBudget,
    },
    security: {
      scanDependencies: override.security?.scanDependencies ?? base.security.scanDependencies,
      owaspTop10: override.security?.owaspTop10 ?? base.security.owaspTop10,
      hardcodedSecrets: override.security?.hardcodedSecrets ?? base.security.hardcodedSecrets,
    },
    vulnerability: {
      checkNpmAudit: override.vulnerability?.checkNpmAudit ?? base.vulnerability.checkNpmAudit,
      severity: override.vulnerability?.severity ?? base.vulnerability.severity,
    },
    criticalFeatures: override.criticalFeatures ?? base.criticalFeatures,
    language: override.language ?? base.language,
    outputFormat: override.outputFormat ?? base.outputFormat,
    severityThresholds: {
      deployBlock: override.severityThresholds?.deployBlock ?? base.severityThresholds.deployBlock,
      needsApproval: override.severityThresholds?.needsApproval ?? base.severityThresholds.needsApproval,
    },
  };
}

export function detectFramework(repo: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["next"]) return "nextjs";
    if (deps["@remix-run/react"] || deps["@remix-run/node"]) return "remix";
    if (deps["nuxt"] || deps["vue"]) return "nuxt";
    if (deps["react"]) return "react";
    if (deps["vue"]) return "vue";
  } catch {
    // No package.json
  }
  return "generic";
}

export function getEntryPointPatterns(repo: string, config: VibeguideConfig): RegExp[] {
  const framework = config.framework === "auto" ? detectFramework(repo) : config.framework;
  const patterns = config.entryPoints[framework] || config.entryPoints.generic || [];
  return patterns.map((p) => {
    // Convert glob-like pattern to regex: pages/**/*.vue → pages/.*\.vue
    const regex = p
      .replace(/\*\*/g, "::DOUBLESTAR::")
      .replace(/\*/g, "[^/]*")
      .replace(/::DOUBLESTAR::/g, ".*")
      .replace(/\./g, "\\.");
    return new RegExp(regex + "$", "i");
  });
}

export function shouldIgnore(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/\*\*/g, "::DS::")
          .replace(/\*/g, "[^/]*")
          .replace(/::DS::/g, ".*")
          .replace(/\./g, "\\.") +
        "$",
      "i"
    );
    if (regex.test(filePath)) return true;
  }
  return false;
}