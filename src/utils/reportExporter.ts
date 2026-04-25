/** Export session report sang Markdown/JSON/Text. */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { SessionContext } from "./sessionContext.js";

function translateStatus(s: SessionContext["status"]): string {
  const map: Record<string, string> = {
    idle: "Đang chờ",
    analyzing: "Đang phân tích",
    fixing: "Đang sửa",
    testing: "Đang test",
    deploying: "Đang deploy",
    approved: "Đã được duyệt",
    rolled_back: "Đã rollback",
  };
  return map[s] || s;
}

function getTimelineLines(ctx: SessionContext): string[] {
  const lines: string[] = [];
  lines.push(`Phiên làm việc bắt đầu: ${ctx.startedAt}`);
  if (ctx.currentSituation) lines.push(`Tình huống: ${ctx.currentSituation}`);
  lines.push(`Trạng thái: ${translateStatus(ctx.status)}`);
  if (ctx.snapshotId) lines.push(`Snapshot backup: ${ctx.snapshotId}`);
  if (ctx.filesChanged.length) lines.push(`File đã sửa: ${ctx.filesChanged.join(", ")}`);

  for (const event of ctx.events.slice(-10)) {
    const time = new Date(event.timestamp).toLocaleTimeString("vi-VN");
    lines.push(`[${time}] ${event.tool}`);
  }

  if (ctx.founderDecisions.length) {
    const last = ctx.founderDecisions[ctx.founderDecisions.length - 1];
    lines.push(`Quyết định cuối: ${last.type} (${last.note})`);
  }

  return lines;
}

/** Export a report object to markdown or JSON. */
export function exportReport(ctx: SessionContext, format: "markdown" | "json" | "text"): string {
  if (format === "markdown") return toMarkdown(ctx);
  if (format === "json") return JSON.stringify(ctx, null, 2);
  return toText(ctx);
}

function toMarkdown(ctx: SessionContext): string {
  const lines: (string | null)[] = [
    `# Báo cáo phiên làm việc — ${ctx.repo}`,
    "",
    `**Bắt đầu:** ${ctx.startedAt}`,
    `**Trạng thái:** ${translateStatus(ctx.status)}`,
    ctx.snapshotId ? `**Snapshot:** ${ctx.snapshotId}` : null,
    "",
    "## File đã sửa",
    ...(ctx.filesChanged.length ? ctx.filesChanged.map((f) => `- ${f}`) : ["_Chưa có file nào được sửa._"]),
    "",
    "## Timeline",
    ...getTimelineLines(ctx).map((l) => `- ${l}`),
    "",
    "## Quyết định Founder",
    ...(ctx.founderDecisions.length
      ? ctx.founderDecisions.map((d) => `- **${d.type.toUpperCase()}**: ${d.note} (${d.timestamp})`)
      : ["_Chưa có quyết định nào._"]),
    "",
    "## Kết quả test",
    ...(ctx.testResults.length
      ? ctx.testResults.map((t) => `- Bước ${t.step}: ${t.passed ? "✅ PASS" : "❌ FAIL"}${t.note ? ` — ${t.note}` : ""}`)
      : ["_Chưa có kết quả test._"]),
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

function toText(ctx: SessionContext): string {
  const lines: string[] = [
    `BÁO CÁO PHIÊN LÀM VIỆC — ${ctx.repo}`,
    `Bắt đầu: ${ctx.startedAt}`,
    `Trạng thái: ${translateStatus(ctx.status)}`,
    ctx.snapshotId ? `Snapshot: ${ctx.snapshotId}` : "",
    "",
    "FILE ĐÃ SỬA:",
    ...(ctx.filesChanged.length ? ctx.filesChanged.map((f) => `  - ${f}`) : ["  (trống)"]),
    "",
    "TIMELINE:",
    ...getTimelineLines(ctx).map((l) => `  - ${l}`),
    "",
    "QUYẾT ĐỊNH:",
    ...(ctx.founderDecisions.length
      ? ctx.founderDecisions.map((d) => `  - ${d.type}: ${d.note} (${d.timestamp})`)
      : ["  (trống)"]),
  ];
  return lines.filter(Boolean).join("\n");
}

/** Save a report to disk with safe path guard. */
export function saveReport(repo: string, ctx: SessionContext, format: "markdown" | "json" | "text"): string {
  const content = exportReport(ctx, format);
  const ext = format === "markdown" ? "md" : format;
  const fileName = `vibeguide-report-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
  const filePath = path.join(repo, fileName);
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}
