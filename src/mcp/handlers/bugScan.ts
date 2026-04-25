/** Heuristic bug scanner: pattern matching + dependency-aware ranking. */
import * as path from "path";
import type { BugMatch, DepEdge } from "../../types.js";
import { getAllSourceFiles, getFileContent } from "../../utils/scanner.js";
import { matchPatterns } from "../../utils/heuristics.js";
import { getCachedDeps } from "./impact.js";

const TOP_BUG_MATCHES = 10;

export interface HeuristicBugResult {
  summary: string;
  patternCounts: Record<string, number>;
  matches: BugMatch[];
  suspiciousFiles: string[];
  totalScanned: number;
  totalMatches: number;
  truncated: boolean;
}

/** Build a HeuristicBugResult by combining symptom keywords with the dep graph. */
export async function createHeuristicBugScan(repo: string, symptom: string): Promise<HeuristicBugResult> {
  const deps = await (getCachedDeps(repo));
  const allSourceFiles = getAllSourceFiles(repo);
  const suspicious = findSuspiciousFiles(allSourceFiles, splitKeywords(symptom));
  const scanSet = buildRelatedScanSet(suspicious, deps.edges);
  const matches = scanBugPatterns(repo, allSourceFiles, scanSet);
  const patternCounts = countPatterns(matches);

  matches.sort((a, b) => b.score - a.score);
  return {
    summary: buildBugSummary(allSourceFiles.length, matches, patternCounts),
    patternCounts,
    matches: matches.slice(0, TOP_BUG_MATCHES),
    suspiciousFiles: suspicious.slice(0, 10),
    totalScanned: allSourceFiles.length,
    totalMatches: matches.length,
    truncated: matches.length > TOP_BUG_MATCHES,
  };
}

function splitKeywords(value: string): string[] {
  return value.toLowerCase().split(/\s+/).filter((keyword) => keyword.length > 2);
}

function basenameWithoutExt(file: string): string {
  return path.basename(file, path.extname(file)).toLowerCase();
}

function findSuspiciousFiles(files: string[], keywords: string[]): string[] {
  return files.filter((file) => keywords.some((keyword) => basenameWithoutExt(file).includes(keyword)));
}

function buildRelatedScanSet(suspicious: string[], edges: DepEdge[]): Set<string> {
  const scanSet = new Set<string>(suspicious);
  for (const file of suspicious) addNeighborFiles(scanSet, file, edges);
  return scanSet;
}

function addNeighborFiles(scanSet: Set<string>, file: string, edges: DepEdge[]): void {
  for (const edge of edges) {
    if (edge.from === file) scanSet.add(edge.to);
    if (edge.to === file) scanSet.add(edge.from);
  }
}

function scanBugPatterns(repo: string, files: string[], scanSet: Set<string>): BugMatch[] {
  const matches: BugMatch[] = [];
  for (const file of files) {
    const content = getFileContent(file, repo);
    if (!content) continue;

    for (const match of matchPatterns(content, file)) {
      const baseScore = severityScore(match.pattern.severity);
      matches.push({ pattern: match.pattern.id, file, line: match.line, score: scanSet.has(file) ? baseScore * 1.2 : baseScore });
    }
  }
  return matches;
}

function severityScore(severity: string): number {
  if (severity === "critical") return 1.0;
  if (severity === "high") return 0.8;
  return 0.5;
}

function countPatterns(matches: BugMatch[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const match of matches) counts[match.pattern] = (counts[match.pattern] || 0) + 1;
  return counts;
}

function buildBugSummary(scanned: number, matches: BugMatch[], patternCounts: Record<string, number>): string {
  return `Scan ${scanned} file, phat hien ${matches.length} bug pattern (${Object.keys(patternCounts).length} loai). Nghiem trong nhat: ${matches[0]?.pattern || "N/A"} o ${matches[0]?.file || ""}.`;
}
