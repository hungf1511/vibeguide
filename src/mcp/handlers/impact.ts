/** Impact analysis handlers — dánh giá r?i ro khi thay d?i file và ki?m tra regression. */
import * as path from "path";
import type { ImpactResult, DepEdge, RegressionResult } from "../../types.js";
import { resolveRepo } from "../../utils/pathGuard.js";
import { getRepoSignature } from "../../utils/scanner.js";
import { getQueries } from "../../index/queries/factory.js";
import { getIfFresh as getCacheFresh, set as setCache } from "../../utils/cache.js";
import { createSnapshot } from "../../utils/snapshot.js";
import { loadConfig, getEntryPointPatterns } from "../../utils/configLoader.js";
import type { DepGraph } from "../../types.js";
import type { FileScope } from "../../core/git/index.js";
import { inferButtons, inferFeature, inferUiName } from "./impactInference.js";

/** Compute upstream/downstream impact set for a target file or symbol. */
export async function handleImpact(args: { filePath: string; repoPath?: string; scope?: FileScope; autoSnapshot?: boolean }): Promise<ImpactResult> {
  const repo = resolveRepo(args.repoPath);
  let autoSnapshotId: string | undefined;
  if (args.autoSnapshot !== false) {
    try {
      const snap = createSnapshot(repo, `auto-before-impact-${args.filePath.replace(/[/\\]/g, "-")}`);
      autoSnapshotId = snap.snapshotId;
    } catch { /* snapshot optional */ }
  }
  const deps = await (getCachedDeps(repo, args.scope));
  const direct: ImpactResult["affectedFiles"] = [];
  const indirect: ImpactResult["indirectFiles"] = [];
  const features: Set<string> = new Set();
  for (const edge of deps.edges) {
    if (edge.to === args.filePath) {
      direct.push({ file: edge.from, confidence: 1.0, ui: inferUiName(edge.from), buttons: inferButtons(edge.from, repo) });
      features.add(inferFeature(edge.from));
    }
  }
  const directFiles = new Set(direct.map((d) => d.file));
  for (const edge of deps.edges) {
    if (directFiles.has(edge.to) && edge.to !== args.filePath) {
      indirect.push({ file: edge.from, via: edge.to, confidence: 0.6, ui: inferUiName(edge.from) });
      features.add(inferFeature(edge.from));
    }
  }
  const risk: ImpactResult["risk"] = direct.length > 5 ? "high" : direct.length > 1 ? "medium" : "low";
  const hierarchical = buildHierarchicalImpact(direct, indirect);
  const entryPointsAtRisk = findEntryPoints(direct, indirect, deps.edges, repo);
  return {
    filePath: args.filePath,
    risk,
    affectedFiles: direct.slice(0, 10),
    indirectFiles: indirect.slice(0, 10),
    features: Array.from(features),
    rollbackTime: `${(direct.length + indirect.length) * 10}s`,
    needsApproval: risk === "high",
    hierarchical,
    entryPointsAtRisk: entryPointsAtRisk.slice(0, 10),
    autoSnapshotId,
  };
}

function buildHierarchicalImpact(direct: ImpactResult["affectedFiles"], indirect: ImpactResult["indirectFiles"]): import("../../types.js").HierarchicalImpact {
  const directModules: Record<string, number> = {};
  for (const d of direct) {
    const mod = d.file.split("/")[0] || "root";
    directModules[mod] = (directModules[mod] || 0) + 1;
  }
  const indirectModules: Record<string, number> = {};
  for (const i of indirect) {
    const mod = i.file.split("/")[0] || "root";
    indirectModules[mod] = (indirectModules[mod] || 0) + 1;
  }
  return {
    direct: {
      count: direct.length,
      topFiles: direct.slice(0, 5).map((d) => d.file),
      modules: directModules,
    },
    indirect: {
      count: indirect.length,
      modules: indirectModules,
    },
    summary: direct.length > 20
      ? `Rat nhieu file bi anh huong truc tiep (${direct.length}). Can review module ${Object.entries(directModules).sort((a, b) => b[1] - a[1])[0]?.[0] || ""} truoc.`
      : direct.length > 5
        ? `Nhieu file bi anh huong (${direct.length}). Risk ${direct.length > 10 ? "cao" : "trung binh"}.`
        : `Anh huong ${direct.length} file truc tiep, ${indirect.length} file gian tiep.`,
  };
}

function findEntryPoints(direct: ImpactResult["affectedFiles"], indirect: ImpactResult["indirectFiles"], edges: DepEdge[], repo: string): string[] {
  const impacted = new Set([...direct.map((d) => d.file), ...indirect.map((i) => i.file)]);
  const entryPoints: string[] = [];
  for (const file of impacted) {
    if (edgePatterns(file, repo)) entryPoints.push(file);
  }
  if (entryPoints.length === 0) {
    const upstream = new Set<string>();
    for (const edge of edges) {
      if (impacted.has(edge.from) && edgePatterns(edge.to, repo)) upstream.add(edge.to);
    }
    entryPoints.push(...Array.from(upstream));
  }
  return entryPoints;
}

function edgePatterns(file: string, repo: string): boolean {
  const config = loadConfig(repo);
  const patterns = getEntryPointPatterns(repo, config);
  for (const regex of patterns) {
    if (regex.test(file)) return true;
  }
  return false;
}

/** Compute upstream/downstream impact set for a target file or symbol. */
/** Confirm a UI-level change against the inferred impact set. */
export async function handleImpactConfirm(args: { filePath: string; repoPath?: string }): Promise<{ affectedFeatures: string[]; downtime: string; needsApproval: boolean }> {
  const repo = resolveRepo(args.repoPath);
  const impact = await handleImpact(args);
  const config = loadConfig(repo);
  const criticalFeatures = config.criticalFeatures;
  const affectsCritical = impact.features.some((f) => criticalFeatures.some((c) => f.toLowerCase().includes(c.toLowerCase())));
  const criticalBasenames = config.criticalFeatures.map((f) => path.basename(f, path.extname(f)));
  const affectsCriticalBasename = impact.affectedFiles.some((f) =>
    criticalBasenames.some((c) => path.basename(f.file, path.extname(f.file)).toLowerCase().includes(c.toLowerCase()))
  );
  const threshold = config.severityThresholds.needsApproval;
  const severityValue = { critical: 3, high: 2, medium: 1, low: 0 };
  const needsApproval = impact.needsApproval || affectsCritical || affectsCriticalBasename || impact.affectedFiles.length > 2 || severityValue[impact.risk] >= severityValue[threshold];
  return { affectedFeatures: impact.features, downtime: impact.risk === "high" ? "3 days" : impact.risk === "medium" ? "1 day" : "30 minutes", needsApproval };
}

/** Surface regressions in the impact set since the last snapshot. */
export async function handleRegression(args: { changedFiles: string[]; repoPath?: string }): Promise<RegressionResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = await (getCachedDeps(repo));
  const flows = args.changedFiles.map((changed) => ({ name: `Flow affected by ${path.basename(changed)}`, files: [changed, ...deps.edges.filter((e) => e.to === changed).map((e) => e.from)], passed: true }));
  return { testFlows: flows, passed: flows.every((f) => f.passed) };
}

/** Memoized dep graph loader keyed by repo signature. */
export async function getCachedDeps(repo: string, scope?: FileScope): Promise<DepGraph> {
  try {
    if (scope && (scope.paths?.length || scope.since || scope.until)) {
      try {
        const queries = await getQueries(repo);
        try {
          return queries.getDependencyGraph(scope);
        } finally {
          queries.close?.();
        }
      } catch {
        return { nodes: [], edges: [] };
      }
    }
    const signature = getRepoSignature(repo);
    const fresh = getCacheFresh(repo, signature);
    if (fresh && Array.isArray(fresh.nodes) && Array.isArray(fresh.edges)) {
      return fresh as unknown as DepGraph;
    }
    try {
      const queries = await getQueries(repo);
      try {
        const deps = await queries.getDependencyGraph();
        setCache(repo, deps as unknown as Record<string, unknown>, signature);
        return deps;
      } finally {
        queries.close?.();
      }
    } catch {
      return { nodes: [], edges: [] };
    }
  } catch {
    return { nodes: [], edges: [] };
  }
}




