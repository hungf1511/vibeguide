/** Quét secret, API key, credential trong source code. */
import type { SecretScanResult, SecretFinding } from "../types.js";
import { getAllSourceFiles } from "./scanner.js";
import { readSafe } from "./readSafe.js";

type SecretSeverity = "critical" | "high" | "medium" | "low";

const SECRET_DICT: { rule: string; regex: RegExp; severity: SecretSeverity }[] = [
  { rule: "aws-access-key", regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, severity: "critical" },
  { rule: "aws-secret-key", regex: /\b[A-Za-z0-9/+]{40}\b(?=.*aws)/gi, severity: "critical" },
  { rule: "github-pat", regex: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g, severity: "critical" },
  { rule: "stripe-key", regex: /\b(sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, severity: "critical" },
  { rule: "google-api", regex: /\bAIza[0-9A-Za-z_-]{35}\b/g, severity: "high" },
  { rule: "openai-key", regex: /\bsk-(?:proj-)?[A-Za-z0-9]{20,}\b/g, severity: "critical" },
  { rule: "slack-token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, severity: "high" },
  { rule: "private-key", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, severity: "critical" },
  { rule: "jwt", regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, severity: "high" },
];

function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq: Record<string, number> = {};
  for (const ch of s) freq[ch] = (freq[ch] || 0) + 1;
  let h = 0;
  for (const c of Object.values(freq)) {
    const p = c / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Scan files for hardcoded secrets and credentials. */
export function scanSecrets(repo: string): SecretScanResult {
  const allFiles = getAllSourceFiles(repo);
  const findings: SecretFinding[] = [];

  for (const file of allFiles) {
    if (file.includes("node_modules") || file.includes("test")) continue;
    const content = readSafe(repo, file);
    if (!content) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { rule, regex, severity } of SECRET_DICT) {
        const m = regex.exec(line);
        regex.lastIndex = 0;
        if (m) {
          findings.push({ file, line: i + 1, rule, evidence: m[0].slice(0, 12) + "...", severity });
        }
      }
      const assignMatch = /\b(secret|token|api[_-]?key|password|pwd|credential)\s*[:=]\s*["']([A-Za-z0-9_/+\-=.]{20,})["']/i.exec(line);
      if (assignMatch) {
        const candidate = assignMatch[2];
        const entropy = shannonEntropy(candidate);
        if (entropy > 4.0) {
          findings.push({ file, line: i + 1, rule: "high-entropy-string", evidence: candidate.slice(0, 12) + "...", severity: "high" });
        }
      }
    }
  }

  const summary = findings.length === 0
    ? "Khong phat hien secret trong code."
    : "Phat hien " + findings.length + " potential secret trong " + allFiles.length + " file. Critical: " + findings.filter((f) => f.severity === "critical").length;

  return {
    findings: findings.slice(0, 30),
    summary,
    scannedFiles: allFiles.length,
  };
}
