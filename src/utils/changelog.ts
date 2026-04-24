/** Sinh changelog tiếng Việt từ git history — dùng structured log từ src/core/git/log.ts */
import { getLog } from "../core/git/log.js";

export interface ChangelogEntry {
  title: string;
  items: string[];
}

/**
 * Generate changelog from git history.
 * Uses structured CommitInfo objects instead of ad-hoc --oneline parsing.
 */
export function generateChangelog(repo: string, count = 20, since?: string, until?: string): {
  version: string;
  date: string;
  sections: ChangelogEntry[];
  raw: string;
} {
  const commits = getLog(repo, count, since, until);

  if (commits.length === 0) {
    return {
      version: "unknown",
      date: new Date().toISOString().split("T")[0],
      sections: [],
      raw: "Không có git history.",
    };
  }

  const sections: Record<string, string[]> = {
    "Tính năng mới": [],
    "Sửa lỗi": [],
    "Tái cấu trúc": [],
    "Hiệu năng": [],
    "Dọn dẹp": [],
    "Thay đổi phá vỡ": [],
    "Khác": [],
  };

  for (const commit of commits) {
    const msg = commit.message.trim();
    if (!msg) continue;

    if (/^BREAKING CHANGE/i.test(msg) || /!:/.test(msg)) {
      sections["Thay đổi phá vỡ"].push(`**${commit.shortSha}** ${msg}`);
    } else if (/^feat(\([^)]*\))?:/i.test(msg)) {
      sections["Tính năng mới"].push(msg.replace(/^feat(\([^)]*\))?:\s*/i, "") + ` *(#${commit.shortSha})*`);
    } else if (/^fix(\([^)]*\))?:/i.test(msg)) {
      sections["Sửa lỗi"].push(msg.replace(/^fix(\([^)]*\))?:\s*/i, "") + ` *(#${commit.shortSha})*`);
    } else if (/^refactor(\([^)]*\))?:/i.test(msg)) {
      sections["Tái cấu trúc"].push(msg.replace(/^refactor(\([^)]*\))?:\s*/i, "") + ` *(#${commit.shortSha})*`);
    } else if (/^perf(\([^)]*\))?:/i.test(msg)) {
      sections["Hiệu năng"].push(msg.replace(/^perf(\([^)]*\))?:\s*/i, "") + ` *(#${commit.shortSha})*`);
    } else if (/^(chore|docs|test|style)(\([^)]*\))?:/i.test(msg)) {
      sections["Dọn dẹp"].push(msg.replace(/^(chore|docs|test|style)(\([^)]*\))?:\s*/i, "") + ` *(#${commit.shortSha})*`);
    } else {
      sections["Khác"].push(msg + ` *(#${commit.shortSha})*`);
    }
  }

  const activeSections: ChangelogEntry[] = [];
  for (const [title, items] of Object.entries(sections)) {
    if (items.length > 0) activeSections.push({ title, items });
  }

  const rawLines = [`## Changelog (${new Date().toISOString().split("T")[0]})`, ""];
  for (const s of activeSections) {
    rawLines.push(`### ${s.title}`);
    for (const item of s.items) rawLines.push(`- ${item}`);
    rawLines.push("");
  }

  return {
    version: commits[0]?.refName || "unknown",
    date: new Date().toISOString().split("T")[0],
    sections: activeSections,
    raw: rawLines.join("\n"),
  };
}
