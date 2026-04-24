/** Briefing handlers — founder_brief, meeting_notes. */
import { resolveRepo } from "../../utils/pathGuard.js";
import { generateChangelog } from "../../utils/changelog.js";
import { getSession, getTimeline, generateProgressSummary } from "../../utils/sessionContext.js";
import { getGitStatus } from "../../utils/scanner.js";
import type { FounderBriefResult, MeetingNotesResult } from "../../types.js";

export async function handleFounderBrief(args: { repoPath?: string; days?: number }): Promise<FounderBriefResult> {
  const repo = resolveRepo(args.repoPath);
  const days = args.days ?? 7;
  const ctx = getSession(repo);
  const changelog = generateChangelog(repo, days * 5);

  const highlights: string[] = [];
  for (const section of changelog.sections) {
    if (section.title === "Tính năng mới") {
      highlights.push(...section.items.slice(0, 3).map((i) => "Tính năng mới: " + i));
    }
    if (section.title === "Sửa lỗi") {
      highlights.push(...section.items.slice(0, 2).map((i) => "Sửa lỗi: " + i));
    }
  }

  const recentEvents = ctx.events.slice(-20);
  const toolCounts: Record<string, number> = {};
  for (const e of recentEvents) toolCounts[e.tool] = (toolCounts[e.tool] || 0) + 1;
  const mostUsed = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const nextSteps: string[] = [];
  if (ctx.status === "fixing") nextSteps.push("Tiếp tục sửa lỗi đang xử lý");
  if (ctx.status === "testing") nextSteps.push("Hoàn tất test các bước còn lại");
  if (ctx.status === "deploying") nextSteps.push("Kiểm tra deploy_check trước khi đẩy production");
  if (ctx.filesChanged.length > 0 && !ctx.snapshotId) nextSteps.push("Tạo snapshot trước khi deploy");

  const brief = [
    "# Báo cáo tuần (" + days + " ngày)",
    "",
    "## Điểm nổi bật",
    ...(highlights.length > 0 ? highlights.map((h) => "- " + h) : ["- Không có commit mới trong " + days + " ngày"]),
    "",
    "## Hoạt động",
    "- Tổng " + recentEvents.length + " action trong session hiện tại",
    mostUsed.length > 0 ? "- Tool dùng nhiều: " + mostUsed.map(([n, c]) => n + " (" + c + ")").join(", ") : "",
    "- Trạng thái: " + ctx.status,
    "",
    "## Bước tiếp theo",
    ...(nextSteps.length > 0 ? nextSteps.map((s) => "- " + s) : ["- Không có việc đang lo"]),
  ].filter(Boolean).join("\n");

  return { brief, highlights, nextSteps };
}

export async function handleMeetingNotes(args: { repoPath?: string }): Promise<MeetingNotesResult> {
  const repo = resolveRepo(args.repoPath);
  const ctx = getSession(repo);
  const status = getGitStatus(repo);

  const done: string[] = [];
  const inProgress: string[] = [];
  const blockers: string[] = [];

  for (const decision of ctx.founderDecisions) {
    if (decision.type === "approve") done.push("Founder duyệt: " + decision.note);
    if (decision.type === "rollback") blockers.push("Đã rollback: " + decision.note);
    if (decision.type === "reject") blockers.push("Founder từ chối: " + decision.note);
  }

  for (const test of ctx.testResults) {
    if (test.passed) done.push("Test bước " + test.step + " pass: " + test.note);
    else blockers.push("Test bước " + test.step + " fail: " + test.note);
  }

  if (ctx.status === "fixing") inProgress.push("Đang sửa lỗi");
  if (ctx.status === "testing") inProgress.push("Đang test");
  if (ctx.status === "deploying") inProgress.push("Đang deploy");
  if (ctx.status === "analyzing") inProgress.push("Đang phân tích impact");

  if (status.modified.length > 0) inProgress.push(status.modified.length + " file đang sửa chưa commit");

  const notes = [
    "# Biên bản họp",
    "",
    "Repo: " + ctx.repo,
    "Bắt đầu session: " + ctx.startedAt,
    "Trạng thái: " + ctx.status,
    "",
    "## Đã xong",
    ...(done.length > 0 ? done.map((d) => "- " + d) : ["- (chưa ghi nhận)"]),
    "",
    "## Đang làm",
    ...(inProgress.length > 0 ? inProgress.map((d) => "- " + d) : ["- (không có)"]),
    "",
    "## Blocker",
    ...(blockers.length > 0 ? blockers.map((d) => "- " + d) : ["- (không có)"]),
  ].join("\n");

  return { done, inProgress, blockers, notes };
}
