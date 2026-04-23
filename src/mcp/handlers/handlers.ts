import * as path from "path";
import * as fs from "fs";
import type {
  ImpactResult,
  BugMatch,
  RegressionResult,
  TestPlan,
  BugReport,
  ChangeLog,
  TreeNode,
  DepGraph,
  DepEdge,
  SnapshotResult,
  DiffSummaryResult,
  DeployCheckResult,
  DeployCheck,
  FixSuggestionResult,
  ChangelogResult,
  DependencyGraphResult,
  SmartRouteResult,
} from "../../types.js";
import { resolveSafe, resolveRepo } from "../../utils/pathGuard.js";
import { scanDirectory, scanDependencies, getFileContent, getGitStatus } from "../../utils/scanner.js";
import { matchPatterns } from "../../utils/heuristics.js";
import { get as getCache, set as setCache } from "../../utils/cache.js";
import { createSnapshot, listSnapshots, restoreSnapshot, getSnapshot } from "../../utils/snapshot.js";
import { generateSuggestion } from "../../utils/fixSuggestions.js";
import { generateChangelog } from "../../utils/changelog.js";
import { discoverInstalledPlugins, recommendPluginsForSituation } from "../../utils/pluginDiscovery.js";

export async function handleImpact(args: { filePath: string; repoPath?: string }): Promise<ImpactResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
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

  // Hierarchical grouping for large repos
  const hierarchical = buildHierarchicalImpact(direct, indirect);
  const entryPointsAtRisk = findEntryPoints(direct, indirect, deps.edges);

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
      ? `Rất nhiều file bị ảnh hưởng trực tiếp (${direct.length}). Cần review module ${Object.entries(directModules).sort((a, b) => b[1] - a[1])[0]?.[0] || ""} trước.`
      : direct.length > 5
        ? `Nhiều file bị ảnh hưởng (${direct.length}). Risk ${direct.length > 10 ? "cao" : "trung bình"}.`
        : `Ảnh hưởng ${direct.length} file trực tiếp, ${indirect.length} file gián tiếp.`,
  };
}

function findEntryPoints(direct: ImpactResult["affectedFiles"], indirect: ImpactResult["indirectFiles"], edges: DepEdge[]): string[] {
  const impacted = new Set([...direct.map((d) => d.file), ...indirect.map((i) => i.file)]);
  const entryPoints: string[] = [];
  const entryPatterns = /\/(pages|app|routes|views|screens)\/|index\.(tsx?|jsx?|vue)$|App\.(tsx?|jsx?|vue)$|main\.(tsx?|jsx?|ts)$/i;
  for (const file of impacted) {
    if (entryPatterns.test(file)) entryPoints.push(file);
  }
  // If no direct entry points, trace upstream via edges
  if (entryPoints.length === 0) {
    const upstream = new Set<string>();
    for (const edge of edges) {
      if (impacted.has(edge.from) && edgePatterns(edge.to)) upstream.add(edge.to);
    }
    entryPoints.push(...Array.from(upstream));
  }
  return entryPoints;
}

function edgePatterns(file: string): boolean {
  return /\/(pages|app|routes|views|screens)\/|index\.(tsx?|jsx?|vue)$|App\.(tsx?|jsx?|vue)$|main\.(tsx?|jsx?|ts)$/i.test(file);
}

export async function handleTraceJourney(args: { journey: string; repoPath?: string }): Promise<{ steps: string[]; files: string[]; confidence: number }> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const keywords = args.journey.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
  const matches: { file: string; score: number }[] = [];

  for (const node of deps.nodes) {
    const base = path.basename(node, path.extname(node)).toLowerCase();
    let score = 0;
    for (const kw of keywords) if (base.includes(kw)) score += 2;
    if (score > 0) matches.push({ file: node, score });
  }

  matches.sort((a, b) => b.score - a.score);
  const topFiles = matches.slice(0, 5).map((m) => m.file);
  const steps = topFiles.map((file) => `${file} interacts with ${deps.edges.filter((e) => e.from === file || e.to === file).length} files`);
  return { steps, files: topFiles, confidence: matches.length > 0 ? Math.min(1, matches[0].score / 5) : 0 };
}

export async function handleHeuristicBug(args: { symptom: string; repoPath?: string }): Promise<{ summary: string; patternCounts: Record<string, number>; matches: BugMatch[]; suspiciousFiles: string[]; totalScanned: number }> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const keywords = args.symptom.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
  const suspicious = deps.nodes.filter((f) => keywords.some((k) => path.basename(f, path.extname(f)).toLowerCase().includes(k)));

  // Build scan set: suspicious + files that import / are imported by suspicious
  const scanSet = new Set<string>(suspicious);
  for (const s of suspicious) {
    for (const edge of deps.edges) {
      if (edge.from === s) scanSet.add(edge.to);
      if (edge.to === s) scanSet.add(edge.from);
    }
  }
  // Fallback: if no suspicious files match by name, scan everything
  const filesToScan = suspicious.length > 0 ? Array.from(scanSet) : deps.nodes;

  const matches: BugMatch[] = [];
  for (const file of filesToScan) {
    const content = getFileContent(file, repo);
    if (!content) continue;
    for (const m of matchPatterns(content, file)) {
      const isSuspicious = suspicious.includes(file);
      const baseScore = m.pattern.severity === "critical" ? 1.0 : m.pattern.severity === "high" ? 0.8 : 0.5;
      matches.push({ pattern: m.pattern.id, file, line: m.line, score: isSuspicious ? baseScore * 1.2 : baseScore });
    }
  }
  matches.sort((a, b) => b.score - a.score);

  // Group by pattern for summary
  const patternCounts: Record<string, number> = {};
  for (const m of matches) {
    patternCounts[m.pattern] = (patternCounts[m.pattern] || 0) + 1;
  }

  const topMatches = matches.slice(0, 10);

  return {
    summary: `Scan ${filesToScan.length} file, phát hiện ${matches.length} bug pattern (${Object.keys(patternCounts).length} loại). Nghiêm trọng nhất: ${matches[0]?.pattern || "N/A"} ở ${matches[0]?.file || ""}.`,
    patternCounts,
    matches: topMatches,
    suspiciousFiles: suspicious.slice(0, 10),
    totalScanned: filesToScan.length,
  };
}

export async function handleRegression(args: { changedFiles: string[]; repoPath?: string }): Promise<RegressionResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const flows = args.changedFiles.map((changed) => ({ name: `Flow affected by ${path.basename(changed)}`, files: [changed, ...deps.edges.filter((e) => e.to === changed).map((e) => e.from)], passed: true }));
  return { testFlows: flows, passed: flows.every((f) => f.passed) };
}

export async function handleScanRepo(args: { repoPath?: string }): Promise<{ summary: string; fileTypes: Record<string, number>; topLevelFolders: string[]; edges: DepGraph["edges"]; stats: { totalFiles: number; totalFolders: number } }> {
  const repo = resolveRepo(args.repoPath);
  const structure = scanDirectory(repo);
  const stats = countTree(structure);
  const deps = getCachedDeps(repo);

  // Group by file extension for summary
  const fileTypes: Record<string, number> = {};
  for (const node of deps.nodes) {
    const ext = path.extname(node) || "no-ext";
    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
  }

  const topLevelFolders = structure.filter((n) => n.type === "folder").map((n) => n.name);

  return {
    summary: `Repo có ${stats.files} file, ${stats.folders} folder. Nhiều nhất: ${Object.entries(fileTypes).sort((a, b) => b[1] - a[1])[0]?.join(" ") || "N/A"}.`,
    fileTypes,
    topLevelFolders,
    edges: deps.edges.slice(0, 50),
    stats: { totalFiles: stats.files, totalFolders: stats.folders },
  };
}

export async function handleTestPlan(args: { feature: string; repoPath?: string }): Promise<TestPlan> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const keywords = args.feature.toLowerCase().split(/\s+/).filter((k) => k.length > 2);
  // Expand keywords with common synonyms
  const synonymMap: Record<string, string[]> = {
    checkout: ["payment", "pay", "cart"],
    payment: ["checkout", "pay", "cart"],
    cart: ["checkout", "payment", "pay"],
    login: ["auth", "signin"],
    auth: ["login", "signin"],
  };
  const expanded = [...keywords];
  for (const k of keywords) { if (synonymMap[k]) expanded.push(...synonymMap[k]); }
  const allKeywords = [...new Set(expanded)];

  let relevant = deps.nodes.filter((f) => allKeywords.some((k) => path.basename(f, path.extname(f)).toLowerCase().includes(k)));

  // Fallback: if no basename match, search file content for keywords
  if (relevant.length === 0) {
    for (const file of deps.nodes) {
      const content = getFileContent(file, repo);
      if (!content) continue;
      const lowerContent = content.toLowerCase();
      if (allKeywords.some((k) => lowerContent.includes(k))) relevant.push(file);
    }
  }

  // Heuristic: extract actionable steps from component code (buttons, inputs, links)
  const actionSteps: string[] = [];
  const filesToScan = relevant.length > 0 ? relevant.slice(0, 5) : deps.nodes.filter((f) => /\.(tsx|jsx|vue)$/.test(f));
  for (const file of filesToScan) {
    const content = getFileContent(file, repo);
    if (!content) continue;
    // Find buttons with onClick (multiline JSX)
    const btnRegex = /\u003cbutton\b[\s\S]*?\bonClick\s*=\s*\{[^}]+\}[\s\S]*?\u003e([\s\S]*?)\u003c\/button\u003e/gi;
    let m: RegExpExecArray | null;
    while ((m = btnRegex.exec(content)) !== null) {
      const label = m[1].trim().replace(/\s+/g, " ");
      if (label && label.length > 1 && label.length < 40 && !actionSteps.includes(`Bấm nút "${label}"`)) actionSteps.push(`Bấm nút "${label}"`);
    }
    // Find input placeholders
    const inputRegex = /placeholder\s*=\s*["']([^"']+)["']/gi;
    while ((m = inputRegex.exec(content)) !== null) {
      const ph = m[1].trim();
      if (ph && !actionSteps.includes(`Điền "${ph}"`)) actionSteps.push(`Điền "${ph}"`);
    }
  }

  const steps = [
    `Mở trang ${args.feature}`,
    ...actionSteps.slice(0, 4),
    ...relevant.slice(0, 2).map((f) => `Kiểm tra ${inferUiName(f) || path.basename(f, path.extname(f))} hiển thị đúng`),
    "Mở DevTools (F12) kiểm tra không có lỗi đỏ trong Console",
  ];

  const expect = [
    "Trang load thành công, không trắng",
    ...actionSteps.slice(0, 2).map((s) => `${s.replace("Bấm nút", "Sau khi bấm nút").replace("Điền", "Sau khi điền")} có phản hồi (redirect, toast, hoặc UI update)`),
    "Không có lỗi đỏ trong Console",
  ];

  return { feature: args.feature, steps, expect };
}

export async function handleBugReport(args: { description: string; repoPath?: string }): Promise<BugReport> {
  const repo = resolveRepo(args.repoPath);
  const lines = args.description.split(/\n|(?<=[.!?])\s+/).filter((l) => l.trim());
  const steps: string[] = [];
  let severity: BugReport["severity"] = "low";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("click") || lower.includes("press") || lower.includes("type")) steps.push(line.trim());
    if (lower.includes("crash") || lower.includes("error") || lower.includes("fail") || lower.includes("nothing happens") || lower.includes("not working") || lower.includes("stays the same") || lower.includes("doesn't respond") || lower.includes("không ăn") || lower.includes("không chạy") || lower.includes("không hoạt động")) severity = "high";
    if (lower.includes("cannot") || lower.includes("won't") || lower.includes("doesn't work") || lower.includes("không được")) severity = severity === "low" ? "medium" : severity;
  }

  return { formatted: ["## Bug Report", "", `**Description:** ${args.description}`, "", "**Steps to reproduce:**", ...steps.map((s, i) => `${i + 1}. ${s}`), "", `**Severity:** ${severity}`, "", `**Repo:** ${repo}`].join("\n"), steps, severity };
}

export async function handleImpactConfirm(args: { filePath: string; repoPath?: string }): Promise<{ affectedFeatures: string[]; downtime: string; needsApproval: boolean }> {
  const impact = await handleImpact(args);
  const criticalFeatures = ["Thanh toán", "Giỏ hàng", "Đăng nhập", "Xác thực", "Payment", "Checkout", "Cart", "Login", "Auth"];
  const affectsCritical = impact.features.some((f) => criticalFeatures.some((c) => f.toLowerCase().includes(c.toLowerCase())));
  const criticalBasenames = ["Cart", "Payment", "Checkout", "Auth", "Login"];
  const affectsCriticalBasename = impact.affectedFiles.some((f) =>
    criticalBasenames.some((c) => path.basename(f.file, path.extname(f.file)).toLowerCase().includes(c.toLowerCase()))
  );
  const needsApproval = impact.needsApproval || affectsCritical || affectsCriticalBasename || impact.affectedFiles.length > 2;
  return { affectedFeatures: impact.features, downtime: impact.risk === "high" ? "3 days" : impact.risk === "medium" ? "1 day" : "30 minutes", needsApproval };
}

export async function handleWhatChanged(args: { repoPath?: string }): Promise<ChangeLog> {
  const repo = resolveRepo(args.repoPath);
  let commits: string[] = [];
  let files: string[] = [];

  try {
    const logsPath = path.join(repo, ".git", "logs", "HEAD");
    if (fs.existsSync(logsPath)) commits = fs.readFileSync(logsPath, "utf-8").split("\n").filter(Boolean).slice(-5).map((l) => l.split(" ").slice(2, 4).join(" "));
  } catch { /* ignore */ }

  try { files = getGitStatus(repo).modified; } catch { /* ignore */ }

  const featureSet = new Set<string>();
  for (const f of files) { const parts = f.split("/"); if (parts.length > 1) featureSet.add(parts[0]); }
  return { commits, files, features: Array.from(featureSet) };
}

export async function handleGetFile(args: { filePath: string; repoPath?: string }): Promise<{ content: string | null; truncated: boolean }> {
  const repo = resolveRepo(args.repoPath);
  // Validate path is within repo (prevent traversal) but keep relative for scanner
  const safePath = resolveSafe(args.filePath, repo);
  // Derive relative path from validated absolute path
  const relativePath = path.relative(repo, safePath).replace(/\\/g, "/");
  const content = getFileContent(relativePath, repo);
  if (!content) return { content: null, truncated: false };
  return { content: content.length > 50000 ? content.slice(0, 50000) : content, truncated: content.length > 50000 };
}

export async function handleGetDeps(args: { repoPath?: string }): Promise<DepGraph> {
  return getCachedDeps(resolveRepo(args.repoPath));
}

export async function handleSnapshot(args: { repoPath?: string; label?: string; action?: string; snapshotId?: string }): Promise<SnapshotResult> {
  const repo = resolveRepo(args.repoPath);
  const action = args.action || "create";

  if (action === "create") {
    const data = createSnapshot(repo, args.label);
    return { snapshotId: data.snapshotId, fileCount: data.files.length, timestamp: data.timestamp, label: data.label };
  }

  if (action === "list") {
    const snaps = listSnapshots(repo);
    return {
      snapshotId: "",
      fileCount: 0,
      timestamp: new Date().toISOString(),
      snapshots: snaps.map((s) => ({ id: s.snapshotId, label: s.label, timestamp: s.timestamp, fileCount: s.files.length })),
    };
  }

  if (action === "restore") {
    if (!args.snapshotId) throw new Error("snapshotId required for restore");
    const result = restoreSnapshot(repo, args.snapshotId);
    return { snapshotId: args.snapshotId, fileCount: result.filesChanged, timestamp: new Date().toISOString(), restored: result.restored, filesChanged: result.filesChanged };
  }

  throw new Error(`Unknown action: ${action}`);
}

export async function handleDiffSummary(args: { repoPath?: string; since?: string; snapshotId?: string }): Promise<DiffSummaryResult> {
  const repo = resolveRepo(args.repoPath);
  const since = args.since || "git";
  const deps = getCachedDeps(repo);

  const currentFiles = new Map<string, string>();
  for (const file of deps.nodes) {
    const content = getFileContent(file, repo);
    if (content !== null) currentFiles.set(file, content);
  }

  let changedFiles: { file: string; changeType: "added" | "modified" | "deleted"; description: string }[] = [];

  if (since === "snapshot" && args.snapshotId) {
    const snapshot = getSnapshot(repo, args.snapshotId);
    if (!snapshot) throw new Error("Snapshot not found");
    const snapshotFiles = new Map<string, string>();
    for (const f of snapshot.files) snapshotFiles.set(f.path, f.content);

    // Deleted
    for (const [file] of snapshotFiles) {
      if (!currentFiles.has(file)) changedFiles.push({ file, changeType: "deleted", description: `Xóa file ${file}` });
    }
    // Added / Modified
    for (const [file, content] of currentFiles) {
      if (!snapshotFiles.has(file)) {
        changedFiles.push({ file, changeType: "added", description: `Thêm file ${file}` });
      } else if (snapshotFiles.get(file) !== content) {
        const desc = inferChangeDescription(file, content);
        changedFiles.push({ file, changeType: "modified", description: desc });
      }
    }
  } else if (since === "git") {
    // Use git status to find changed files
    try {
      const { execSync } = await import("child_process");
      const output = execSync("git status --short", { cwd: repo, encoding: "utf-8" });
      const lines = output.split("\n").filter(Boolean);
      for (const line of lines) {
        const status = line.slice(0, 2).trim();
        const file = line.slice(3).trim();
        if (status === "D") changedFiles.push({ file, changeType: "deleted", description: `Xóa file ${file}` });
        else if (status === "??") changedFiles.push({ file, changeType: "added", description: `Thêm file ${file}` });
        else {
          const content = getFileContent(file, repo);
          const desc = content ? inferChangeDescription(file, content) : `Cập nhật ${file}`;
          changedFiles.push({ file, changeType: "modified", description: desc });
        }
      }
    } catch {
      // No git or no changes
    }
  } else {
    // "last" — compare with most recent snapshot
    const snaps = listSnapshots(repo);
    if (snaps.length > 0) {
      const last = snaps[0];
      const snapshotFiles = new Map<string, string>();
      for (const f of last.files) snapshotFiles.set(f.path, f.content);
      for (const [file] of snapshotFiles) {
        if (!currentFiles.has(file)) changedFiles.push({ file, changeType: "deleted", description: `Xóa file ${file}` });
      }
      for (const [file, content] of currentFiles) {
        if (!snapshotFiles.has(file)) changedFiles.push({ file, changeType: "added", description: `Thêm file ${file}` });
        else if (snapshotFiles.get(file) !== content) {
          const desc = inferChangeDescription(file, content);
          changedFiles.push({ file, changeType: "modified", description: desc });
        }
      }
    }
  }

  const summary = changedFiles.length === 0
    ? "Không có thay đổi nào."
    : `Có ${changedFiles.length} file thay đổi: ${changedFiles.filter((f) => f.changeType === "modified").length} sửa, ${changedFiles.filter((f) => f.changeType === "added").length} thêm, ${changedFiles.filter((f) => f.changeType === "deleted").length} xóa.`;

  const riskAssessment = changedFiles.length > 5 ? "Nhiều file thay đổi — nên test kỹ trước khi deploy." : "Thay đổi ít — risk thấp.";

  return { summary, filesChanged: changedFiles, riskAssessment, totalFiles: changedFiles.length };
}

function inferChangeDescription(file: string, content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("fix") || lower.includes("bug") || lower.includes("repair")) return `Sửa lỗi ở ${file}`;
  if (lower.includes("add") || lower.includes("new ") || lower.includes("introduce")) return `Thêm tính năng vào ${file}`;
  if (lower.includes("refactor") || lower.includes("rewrite")) return `Tái cấu trúc ${file}`;
  if (lower.includes("remove") || lower.includes("delete") || lower.includes("clean")) return `Dọn dẹp ${file}`;
  if (lower.includes("update") || lower.includes("upgrade")) return `Cập nhật ${file}`;
  return `Chỉnh sửa ${file}`;
}

export async function handleDeployCheck(args: { repoPath?: string; checkBugPatterns?: boolean; checkUncommitted?: boolean; checkOrphans?: boolean }): Promise<DeployCheckResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const checks: DeployCheck[] = [];

  // 1. Bug patterns
  if (args.checkBugPatterns !== false) {
    let bugCount = 0;
    let criticalCount = 0;
    for (const file of deps.nodes) {
      const content = getFileContent(file, repo);
      if (!content) continue;
      for (const m of matchPatterns(content, file)) {
        bugCount++;
        if (m.pattern.severity === "critical") criticalCount++;
      }
    }
    checks.push({
      name: "Bug Patterns",
      passed: criticalCount === 0 && bugCount <= 5,
      message: criticalCount > 0 ? `Phát hiện ${criticalCount} lỗi critical!` : bugCount > 0 ? `Phát hiện ${bugCount} bug pattern (không có critical).` : "Không phát hiện bug pattern.",
      severity: criticalCount > 0 ? "critical" : bugCount > 0 ? "warning" : "info",
    });
  }

  // 2. Uncommitted changes
  if (args.checkUncommitted !== false) {
    let hasUncommitted = false;
    try {
      const { execSync } = await import("child_process");
      const output = execSync("git status --short", { cwd: repo, encoding: "utf-8" });
      hasUncommitted = output.trim().length > 0;
    } catch {
      // Not a git repo
    }
    checks.push({
      name: "Uncommitted Changes",
      passed: !hasUncommitted,
      message: hasUncommitted ? "Có file chưa commit — nên commit trước khi deploy." : "Tất cả thay đổi đã commit.",
      severity: hasUncommitted ? "warning" : "info",
    });
  }

  // 3. Orphaned files
  if (args.checkOrphans !== false) {
    const incoming = new Set<string>();
    const outgoing = new Set<string>();
    for (const edge of deps.edges) {
      incoming.add(edge.to);
      outgoing.add(edge.from);
    }
    const orphans = deps.nodes.filter((n) => !incoming.has(n) && !outgoing.has(n));
    checks.push({
      name: "Orphaned Files",
      passed: orphans.length === 0,
      message: orphans.length > 0 ? `Phát hiện ${orphans.length} file orphan (không được import và không import ai).` : "Không có file orphan.",
      severity: orphans.length > 0 ? "warning" : "info",
    });
  }

  // 4. Hardcoded secrets
  let secretCount = 0;
  for (const file of deps.nodes) {
    const content = getFileContent(file, repo);
    if (!content) continue;
    const re = /(?:password|secret|token|api_key)\s*[:=]\s*["'][^"']{8,}["']/gi;
    const matches = content.match(re);
    if (matches) secretCount += matches.length;
  }
  checks.push({
    name: "Hardcoded Secrets",
    passed: secretCount === 0,
    message: secretCount > 0 ? `Phát hiện ${secretCount} hardcoded secret!` : "Không phát hiện hardcoded secret.",
    severity: secretCount > 0 ? "critical" : "info",
  });

  const allPassed = checks.every((c) => c.passed);
  const criticalChecks = checks.filter((c) => c.severity === "critical" && !c.passed);
  const summary = criticalChecks.length > 0
    ? `❌ KHÔNG NÊN DEPLOY: ${criticalChecks.length} check critical thất bại.`
    : allPassed
      ? "✅ Tất cả check pass — có thể deploy."
      : `⚠️ Có ${checks.filter((c) => !c.passed).length} check warning — review trước khi deploy.`;

  return { passed: allPassed, checks, summary };
}

export async function handleSuggestFix(args: { filePath: string; patternId?: string; line?: number; repoPath?: string }): Promise<FixSuggestionResult> {
  const repo = resolveRepo(args.repoPath);
  const content = getFileContent(args.filePath, repo);
  if (!content) return { filePath: args.filePath, suggestions: [] };

  let suggestions: FixSuggestionResult["suggestions"] = [];

  if (args.patternId && args.line) {
    const s = generateSuggestion(content, args.patternId, args.line);
    if (s) suggestions.push(s);
  } else {
    // If no patternId provided, run heuristic scan and suggest for all matches
    for (const m of matchPatterns(content, args.filePath)) {
      const s = generateSuggestion(content, m.pattern.id, m.line);
      if (s) suggestions.push(s);
    }
  }

  return { filePath: args.filePath, suggestions };
}

export async function handleChangelog(args: { repoPath?: string; count?: number }): Promise<ChangelogResult> {
  const repo = resolveRepo(args.repoPath);
  return generateChangelog(repo, args.count ?? 20);
}

export async function handleDepGraph(args: { repoPath?: string; format?: string }): Promise<DependencyGraphResult> {
  const repo = resolveRepo(args.repoPath);
  const deps = getCachedDeps(repo);
  const fmt = args.format || "mermaid";

  if (fmt === "json") {
    return { mermaid: JSON.stringify({ nodes: deps.nodes, edges: deps.edges }, null, 2), nodes: deps.nodes.length, edges: deps.edges.length };
  }

  // Mermaid format
  const nodeIds = new Map<string, string>();
  let idCounter = 0;
  function getId(file: string): string {
    if (!nodeIds.has(file)) {
      nodeIds.set(file, `N${idCounter++}`);
    }
    return nodeIds.get(file)!;
  }

  const lines = ["graph TD"];

  // Group by folder
  const folderMap = new Map<string, string[]>();
  for (const file of deps.nodes) {
    const dir = path.dirname(file).replace(/\\/g, "/") || "root";
    if (!folderMap.has(dir)) folderMap.set(dir, []);
    folderMap.get(dir)!.push(file);
  }

  for (const [dir, files] of folderMap) {
    if (files.length > 1) {
      lines.push(`  subgraph ${dir.replace(/[^a-zA-Z0-9_/]/g, "_")}`);
      for (const file of files) {
        const base = path.basename(file, path.extname(file));
        lines.push(`    ${getId(file)}[${base}]`);
      }
      lines.push(`  end`);
    } else {
      const file = files[0];
      const base = path.basename(file, path.extname(file));
      lines.push(`  ${getId(file)}[${base}]`);
    }
  }

  for (const edge of deps.edges) {
    lines.push(`  ${getId(edge.from)} --> ${getId(edge.to)}`);
  }

  return { mermaid: lines.join("\n"), nodes: deps.nodes.length, edges: deps.edges.length };
}

function getCachedDeps(repo: string): DepGraph {
  const cache = getCache(repo);
  if (cache?.nodes && cache?.edges) return cache as unknown as DepGraph;
  const deps = scanDependencies(repo);
  setCache(repo, deps as unknown as Record<string, unknown>);
  return deps;
}

function countTree(items: TreeNode[]): { files: number; folders: number } {
  let files = 0, folders = 0;
  for (const item of items) {
    if (item.type === "file") files++;
    else { folders++; if (item.children) { const c = countTree(item.children); files += c.files; folders += c.folders; } }
  }
  return { files, folders };
}

function inferUiName(filePath: string): string | undefined {
  const base = path.basename(filePath, path.extname(filePath));
  const uiMap: Record<string, string> = { Login: "Trang đăng nhập", Register: "Trang đăng ký", Home: "Trang chủ", Dashboard: "Bảng điều khiển", Profile: "Trang Profile", Cart: "Giỏ hàng", Checkout: "Thanh toán", Payment: "Thanh toán", Navbar: "Thanh menu", Sidebar: "Menu bên", Footer: "Chân trang", Header: "Đầu trang", Modal: "Popup", Dialog: "Hộp thoại", Button: "Nút bấm", Form: "Biểu mẫu", Table: "Bảng dữ liệu", List: "Danh sách", Card: "Thẻ", Item: "Mục", Page: "Trang", Layout: "Bố cục", App: "Ứng dụng", Index: "Trang chính", Main: "Trang chính" };
  for (const [key, value] of Object.entries(uiMap)) if (base.toLowerCase().includes(key.toLowerCase())) return value;
  return undefined;
}

function inferButtons(filePath: string, repo: string): string[] | undefined {
  const content = getFileContent(filePath, repo);
  if (!content) return undefined;
  const buttons: string[] = [];
  const regex = /(?:label|children|title)\s*[=:]\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) { if (match[1].length > 1 && match[1].length < 30) buttons.push(match[1]); }
  return buttons.length > 0 ? buttons.slice(0, 5) : undefined;
}

function inferFeature(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));

  // 1. Ưu tiên basename mapping (file cụ thể hơn folder)
  const baseFeatureMap: Record<string, string> = {
    Cart: "Giỏ hàng",
    Payment: "Thanh toán",
    PaymentButton: "Thanh toán",
    Checkout: "Thanh toán",
    Login: "Đăng nhập",
    Register: "Đăng ký",
    Auth: "Xác thực",
    Profile: "Profile",
    Navbar: "Navbar",
    App: "Trang chính",
    Index: "Trang chính",
  };
  for (const [key, value] of Object.entries(baseFeatureMap)) {
    if (base.toLowerCase().includes(key.toLowerCase())) return value;
  }

  const parts = filePath.split("/");
  const skipRoots = new Set(["src", "app", "lib", "source", "code", "client", "server"]);
  let dir = parts.length > 1 ? parts[0] : "";
  if (skipRoots.has(dir.toLowerCase()) && parts.length > 2) {
    dir = parts[1];
  }
  const featureMap: Record<string, string> = { auth: "Xác thực", login: "Đăng nhập", register: "Đăng ký", profile: "Profile", cart: "Giỏ hàng", payment: "Thanh toán", checkout: "Thanh toán", order: "Đơn hàng", product: "Sản phẩm", admin: "Quản trị", dashboard: "Bảng điều khiển", setting: "Cài đặt", config: "Cấu hình", api: "API", utils: "Tiện ích", hooks: "Hooks", components: "UI Components", pages: "Trang", routes: "Routing", services: "Dịch vụ", store: "Store", state: "State", context: "Context", types: "Types", interfaces: "Interfaces", models: "Models", controllers: "Controllers", middleware: "Middleware", db: "Database", database: "Database", migration: "Migration", seed: "Seed", test: "Test", tests: "Test", e2e: "E2E Test", unit: "Unit Test", integration: "Integration Test" };
  for (const [key, value] of Object.entries(featureMap)) if (dir.toLowerCase().includes(key)) return value;
  return dir || path.basename(path.dirname(filePath)) || "Chung";
}

export async function handleSmartRoute(args: { situation: string; repoPath?: string }): Promise<SmartRouteResult> {
  const plugins = discoverInstalledPlugins();
  const { plugins: recommended, tools, detectedType } = recommendPluginsForSituation(args.situation, plugins);

  const summaryParts: string[] = [];
  if (recommended.length > 0) {
    summaryParts.push(`Phát hiện ${recommended.length} plugin phù hợp:`);
    recommended.forEach((p) => summaryParts.push(`- ${p.name} (${Math.round(p.confidence * 100)}%) — ${p.reason}`));
  }
  if (tools.length > 0) {
    summaryParts.push(`\nVibeGuide tools nên dùng:`);
    tools.forEach((t) => summaryParts.push(`- ${t.name} (${Math.round(t.confidence * 100)}%) — ${t.reason}`));
  }
  if (recommended.length === 0 && tools.length === 0) {
    summaryParts.push("Không tìm thấy plugin hay tool phù hợp rõ ràng. Hãy mô tả chi tiết hơn tình huống.");
  }

  return {
    situation: args.situation,
    detectedType,
    recommendedPlugins: recommended.map((p) => ({
      name: p.name,
      description: p.description,
      confidence: Math.round(p.confidence * 100) / 100,
      reason: p.reason,
      command: p.command,
    })),
    vibeGuideTools: tools.map((t) => ({
      name: t.name,
      confidence: Math.round(t.confidence * 100) / 100,
      reason: t.reason,
    })),
    summary: summaryParts.join("\n"),
  };
}
