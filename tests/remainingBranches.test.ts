import { describe, it, expect, vi } from "vitest";
import { scanSecrets } from "../src/utils/secretScan.js";
import { handleTraceJourney, handleHeuristicBug, handleRegression } from "../src/mcp/handlers/bug.js";
import { handleFounderBrief, handleMeetingNotes } from "../src/mcp/handlers/briefing.js";

vi.mock("../src/utils/scanner.js", async () => {
  const actual = await vi.importActual<typeof import("../src/utils/scanner.js")>("../src/utils/scanner.js");
  return {
    ...actual,
    getAllSourceFiles: vi.fn(() => ["src/app.ts"]),
    getFileContent: vi.fn((file: string) => {
      if (file.includes("app")) return `const password = "aB3xK9mP2vL7qW4rT8jN6hG5fD2sA1";\nconst token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";\nconst jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozJxjy5H0r1"`;
      return "";
    }),
    getGitStatus: vi.fn(() => ({ available: true, branch: "main", modified: [], staged: [], untracked: [], ahead: 0 })),
    getRecentCommits: vi.fn(() => []),
  };
});

vi.mock("../src/utils/readSafe.js", () => ({
  readSafe: vi.fn((repo: string, file: string) => {
    if (file.includes("app")) return `const password = "aB3xK9mP2vL7qW4rT8jN6hG5fD2sA1";\nconst token = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";\nconst jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozJxjy5H0r1"`;
    return "";
  }),
}));

vi.mock("../src/mcp/handlers/impact.js", () => ({
  getCachedDeps: vi.fn(async () => ({ nodes: [], edges: [] })),
}));

vi.mock("../src/utils/changelog.js", () => ({
  generateChangelog: vi.fn(() => ({ sections: [{ title: "Tinh nang moi", items: ["feat A"] }, { title: "Sua loi", items: ["fix B"] }] })),
}));

describe("secretScan branches", () => {
  it("finds high entropy password", () => {
    const result = scanSecrets("/repo");
    expect(result.findings.some((f) => f.rule === "high-entropy-string")).toBe(true);
  });

  it("finds github token", () => {
    const result = scanSecrets("/repo");
    expect(result.findings.some((f) => f.rule === "github-pat")).toBe(true);
  });

  it("finds jwt", () => {
    const result = scanSecrets("/repo");
    expect(result.findings.some((f) => f.rule === "jwt")).toBe(true);
  });
});

describe("bug branches", () => {
  it("traces journey", async () => {
    const result = await handleTraceJourney({ journey: "click login button" });
    expect(result.steps).toBeDefined();
  });

  it("runs heuristic bug scan", async () => {
    const result = await handleHeuristicBug({ symptom: "crash" });
    expect(result.summary).toBeDefined();
  });

  it("returns regression with empty changed files", async () => {
    const result = await handleRegression({ changedFiles: [] });
    expect(result.passed).toBe(true);
  });
});

describe("briefing branches", () => {
  it("returns brief with highlights", async () => {
    const result = await handleFounderBrief({ repoPath: "/repo" });
    expect(result.brief).toContain("7");
  });

  it("returns meeting notes with empty context", async () => {
    const result = await handleMeetingNotes({ repoPath: "/repo" });
    expect(result.notes.length).toBeGreaterThan(0);
  });
});
