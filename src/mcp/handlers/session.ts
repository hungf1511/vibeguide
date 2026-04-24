/** Session tracking handlers — smart_route, session_status, export_report. */
import type { SmartRouteResult, ExportReportResult } from "../../types.js";
import { resolveRepo } from "../../utils/pathGuard.js";
import { getSession, getTimeline, generateProgressSummary } from "../../utils/sessionContext.js";
import { exportReport, saveReport } from "../../utils/reportExporter.js";
import { loadConfig } from "../../utils/configLoader.js";
import { discoverInstalledPlugins, recommendPluginsForSituation } from "../../utils/pluginDiscovery.js";

export async function handleSmartRoute(args: { situation: string; repoPath?: string }): Promise<SmartRouteResult> {
  const plugins = discoverInstalledPlugins();
  const { plugins: recommended, tools, detectedType } = recommendPluginsForSituation(args.situation, plugins);
  const summaryParts: string[] = [];
  if (recommended.length > 0) {
    summaryParts.push(`Phat hien ${recommended.length} plugin phu hop:`);
    recommended.forEach((p) => summaryParts.push(`- ${p.name} (${Math.round(p.confidence * 100)}%) - ${p.reason}`));
  }
  if (tools.length > 0) {
    summaryParts.push(`\nVibeGuide tools nen dung:`);
    tools.forEach((t) => summaryParts.push(`- ${t.name} (${Math.round(t.confidence * 100)}%) - ${t.reason}`));
  }
  if (recommended.length === 0 && tools.length === 0) {
    summaryParts.push("Khong tim thay plugin hay tool phu hop ro rang. Hay mo ta chi tiet hon tinh huong.");
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

export async function handleSessionStatus(args: { repoPath?: string }): Promise<{ summary: string; timeline: string[]; status: string; snapshotId?: string; lastAction?: string }> {
  const repo = resolveRepo(args.repoPath);
  const ctx = getSession(repo);
  const timeline = getTimeline(ctx);
  const summary = generateProgressSummary(ctx);
  return {
    summary,
    timeline,
    status: ctx.status,
    snapshotId: ctx.snapshotId,
    lastAction: ctx.lastAction,
  };
}

export async function handleExportReport(args: { repoPath?: string; format?: "markdown" | "json" | "text"; saveToFile?: boolean }): Promise<ExportReportResult> {
  const repo = resolveRepo(args.repoPath);
  const config = loadConfig(repo);
  const format = args.format ?? config.outputFormat ?? "markdown";
  const ctx = getSession(repo);
  const report = exportReport(ctx, format);
  let filePath: string | undefined;
  if (args.saveToFile) {
    filePath = saveReport(repo, ctx, format);
  }
  return { report, filePath, format };
}
