/** Sinh changelog tiếng Việt từ git history. */
import { execFileSync } from "child_process";

export interface ChangelogEntry {
  title: string;
  items: string[];
}

export function generateChangelog(repo: string, count = 20): { version: string; date: string; sections: ChangelogEntry[]; raw: string } {
  let logOutput = "";
  try {
    logOutput = execFileSync("git", ["log", "--oneline", `-${count}`], { cwd: repo, encoding: "utf-8" });
  } catch {
    return { version: "unknown", date: new Date().toISOString().split("T")[0], sections: [], raw: "Không có git history." };
  }

  const lines = logOutput.split("\n").filter(Boolean);
  const sections: Record<string, string[]> = {
    "Tính năng mới": [],
    "Sửa lỗi": [],
    "Tái cấu trúc": [],
    "Hiệu năng": [],
    "Dọn dẹp": [],
    "Thay đổi phá vỡ": [],
    "Khác": [],
  };

  for (const line of lines) {
    const msg = line.slice(line.indexOf(" ") + 1).trim();
    if (!msg) continue;

    if (/^BREAKING CHANGE/i.test(msg) || /!:/.test(msg)) {
      sections["Thay đổi phá vỡ"].push(msg);
    } else if (/^feat(\([^)]*\))?:/i.test(msg)) {
      sections["Tính năng mới"].push(msg.replace(/^feat(\([^)]*\))?:\s*/i, ""));
    } else if (/^fix(\([^)]*\))?:/i.test(msg)) {
      sections["Sửa lỗi"].push(msg.replace(/^fix(\([^)]*\))?:\s*/i, ""));
    } else if (/^refactor(\([^)]*\))?:/i.test(msg)) {
      sections["Tái cấu trúc"].push(msg.replace(/^refactor(\([^)]*\))?:\s*/i, ""));
    } else if (/^perf(\([^)]*\))?:/i.test(msg)) {
      sections["Hiệu năng"].push(msg.replace(/^perf(\([^)]*\))?:\s*/i, ""));
    } else if (/^(chore|docs|test|style)(\([^)]*\))?:/i.test(msg)) {
      sections["Dọn dẹp"].push(msg.replace(/^(chore|docs|test|style)(\([^)]*\))?:\s*/i, ""));
    } else {
      sections["Khác"].push(msg);
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
    version: "unknown",
    date: new Date().toISOString().split("T")[0],
    sections: activeSections,
    raw: rawLines.join("\n"),
  };
}
