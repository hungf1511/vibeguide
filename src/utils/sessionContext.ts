/** Session tracking — lưu timeline, Founder decisions, test results vào ~/.vibeguide/session. */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const SESSION_DIR = path.join(os.homedir(), ".vibeguide", "session");

function ensureDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function sessionKey(repo: string): string {
  const safe = repo.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(SESSION_DIR, `${safe}.json`);
}

interface SessionEvent {
  timestamp: string;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

export interface SessionContext {
  repo: string;
  startedAt: string;
  currentSituation?: string;
  lastAction?: string;
  status: "idle" | "analyzing" | "fixing" | "testing" | "deploying" | "approved" | "rolled_back";
  snapshotId?: string;
  filesChanged: string[];
  testResults: { step: number; passed: boolean; note: string }[];
  events: SessionEvent[];
  founderDecisions: { type: "approve" | "reject" | "rollback"; note: string; timestamp: string }[];
}

export function getSession(repo: string): SessionContext {
  ensureDir();
  const key = sessionKey(repo);
  if (fs.existsSync(key)) {
    try {
      return JSON.parse(fs.readFileSync(key, "utf-8")) as SessionContext;
    } catch {
      // fall through to new session
    }
  }
  return {
    repo,
    startedAt: new Date().toISOString(),
    status: "idle",
    filesChanged: [],
    testResults: [],
    events: [],
    founderDecisions: [],
  };
}

function setSession(repo: string, ctx: SessionContext): void {
  ensureDir();
  fs.writeFileSync(sessionKey(repo), JSON.stringify(ctx, null, 2), "utf-8");
}

export function logEvent(repo: string, event: SessionEvent): void {
  const ctx = getSession(repo);
  ctx.events.push(event);
  ctx.lastAction = event.tool;
  // Infer status from tool name
  if (event.tool.includes("impact")) ctx.status = "analyzing";
  if (event.tool.includes("fix") || event.tool.includes("suggest")) ctx.status = "fixing";
  if (event.tool.includes("test")) ctx.status = "testing";
  if (event.tool.includes("deploy")) ctx.status = "deploying";
  if (event.tool.includes("snapshot")) {
    const snap = event.output as { snapshotId?: string };
    if (snap?.snapshotId) ctx.snapshotId = snap.snapshotId;
  }
  setSession(repo, ctx);
}

export function getTimeline(ctx: SessionContext): string[] {
  const lines: string[] = [];
  lines.push(`Phiên làm việc bắt đầu: ${ctx.startedAt}`);
  if (ctx.currentSituation) lines.push(`Tình huống: ${ctx.currentSituation}`);
  lines.push(`Trạng thái: ${translateStatus(ctx.status)}`);
  if (ctx.snapshotId) lines.push(`Snapshot backup: ${ctx.snapshotId}`);
  if (ctx.filesChanged.length) lines.push(`File đã sửa: ${ctx.filesChanged.join(", ")}`);

  for (const event of ctx.events.slice(-10)) {
    const time = new Date(event.timestamp).toLocaleTimeString("vi-VN");
    lines.push(`[${time}] ${event.tool} → ${summarizeOutput(event)}`);
  }

  if (ctx.founderDecisions.length) {
    const last = ctx.founderDecisions[ctx.founderDecisions.length - 1];
    lines.push(`Quyết định cuối: ${last.type} (${last.note})`);
  }

  return lines;
}

export function generateProgressSummary(ctx: SessionContext): string {
  const parts: string[] = [];

  // Trạng thái hiện tại
  const statusText = translateStatus(ctx.status);
  parts.push(`Hiện tại ${statusText.toLowerCase()}.`);

  // File đã sửa
  if (ctx.filesChanged.length) {
    const files = ctx.filesChanged.slice(0, 3).join(", ");
    const more = ctx.filesChanged.length > 3 ? ` và ${ctx.filesChanged.length - 3} file khác` : "";
    parts.push(`Đã thay đổi: ${files}${more}.`);
  }

  // Snapshot
  if (ctx.snapshotId) {
    parts.push(`Đã tạo snapshot backup: ${ctx.snapshotId}.`);
  }

  // Test results
  const passedTests = ctx.testResults.filter(t => t.passed).length;
  const totalTests = ctx.testResults.length;
  if (totalTests > 0) {
    parts.push(`Test: ${passedTests}/${totalTests} bước pass.`);
  }

  // Last action
  if (ctx.lastAction) {
    const actionDesc = describeLastAction(ctx.lastAction);
    if (actionDesc) parts.push(actionDesc);
  }

  // Quyết định Founder
  if (ctx.founderDecisions.length) {
    const last = ctx.founderDecisions[ctx.founderDecisions.length - 1];
    if (last.type === "approve") parts.push(`Founder đã duyệt: ${last.note}`);
    if (last.type === "reject") parts.push(`Founder từ chối: ${last.note}`);
    if (last.type === "rollback") parts.push(`Đã rollback: ${last.note}`);
  }

  return parts.join(" ");
}

function describeLastAction(tool: string): string | null {
  if (tool.includes("impact")) return "Vừa phân tích ảnh hưởng của thay đổi.";
  if (tool.includes("bug")) return "Vừa scan tìm lỗi trong codebase.";
  if (tool.includes("fix") || tool.includes("suggest")) return "Vừa đề xuất cách sửa lỗi.";
  if (tool.includes("test")) return "Vừa lên kế hoạch test.";
  if (tool.includes("deploy")) return "Vừa kiểm tra điều kiện deploy.";
  if (tool.includes("snapshot")) return "Vừa tạo snapshot backup.";
  return null;
}

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

function summarizeOutput(event: SessionEvent): string {
  const out = event.output as Record<string, unknown>;
  if (event.tool.includes("impact")) {
    const risk = out.risk as string;
    const count = ((out.affectedFiles as unknown[])?.length || 0) + ((out.indirectFiles as unknown[])?.length || 0);
    return `risk ${risk}, ảnh hưởng ${count} file`;
  }
  if (event.tool.includes("scan")) return `${(out.stats as Record<string, number>)?.totalFiles || 0} file scanned`;
  if (event.tool.includes("bug")) return `${(out.matches as unknown[])?.length || 0} bug found`;
  if (event.tool.includes("snapshot")) return `snapshot ${(out as Record<string, string>)?.snapshotId || ""}`;
  if (event.tool.includes("deploy")) return (out as Record<string, string>)?.summary || "deploy check";
  return "done";
}
