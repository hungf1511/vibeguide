import { describe, it, expect, vi } from "vitest";
import { scanSecrets } from "../src/utils/secretScan.js";

vi.mock("../src/utils/scanner.js", () => ({
  getAllSourceFiles: vi.fn(() => ["src/app.ts", "src/config.ts"]),
}));

vi.mock("../src/utils/readSafe.js", () => ({
  readSafe: vi.fn((repo: string, file: string) => {
    if (file === "src/app.ts") return `const key = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`;
    if (file === "src/config.ts") return `const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozJxjy5H0r1`;
    return "";
  }),
}));

describe("secretScan branches", () => {
  it("finds github pat", () => {
    const result = scanSecrets("/repo");
    expect(result.findings.some((f) => f.rule === "github-pat")).toBe(true);
  });

  it("finds jwt", () => {
    const result = scanSecrets("/repo");
    expect(result.findings.some((f) => f.rule === "jwt")).toBe(true);
  });

  it("skips node_modules and test files", async () => {
    const { getAllSourceFiles } = await import("../src/utils/scanner.js");
    vi.mocked(getAllSourceFiles).mockReturnValue(["node_modules/x.ts", "src/app.test.ts", "src/app.ts"]);
    const result = scanSecrets("/repo");
    expect(result.scannedFiles).toBe(3);
  });
});
