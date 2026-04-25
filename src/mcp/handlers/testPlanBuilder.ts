/** Test plan builder used by handle_test_plan and handle_bug_report. */
import * as path from "path";
import type { TestPlan } from "../../types.js";
import { getFileContent } from "../../utils/scanner.js";
import { getCachedDeps } from "./impact.js";

const TEST_PLAN_SYNONYMS: Record<string, string[]> = {
  checkout: ["payment", "pay", "cart"],
  payment: ["checkout", "pay", "cart"],
  cart: ["checkout", "payment", "pay"],
  login: ["auth", "signin"],
  auth: ["login", "signin"],
};

/** Build a test plan from a feature description. */
export async function createTestPlan(repo: string, feature: string): Promise<TestPlan> {
  const deps = await (getCachedDeps(repo));
  const keywords = expandTestKeywords(splitKeywords(feature));
  const relevant = findRelevantFiles(repo, deps.nodes, keywords);
  const actionSteps = extractActionSteps(repo, selectActionScanFiles(relevant, deps.nodes));
  const steps = buildTestSteps(feature, actionSteps, relevant);
  const expect = buildTestExpectations(actionSteps);

  return { feature, steps, expect };
}

function splitKeywords(value: string): string[] {
  return value.toLowerCase().split(/\s+/).filter((keyword) => keyword.length > 2);
}

function basenameWithoutExt(file: string): string {
  return path.basename(file, path.extname(file)).toLowerCase();
}

function expandTestKeywords(keywords: string[]): string[] {
  const expanded = [...keywords];
  for (const keyword of keywords) {
    if (TEST_PLAN_SYNONYMS[keyword]) expanded.push(...TEST_PLAN_SYNONYMS[keyword]);
  }
  return [...new Set(expanded)];
}

function findRelevantFiles(repo: string, nodes: string[], keywords: string[]): string[] {
  const byName = nodes.filter((file) => keywords.some((keyword) => basenameWithoutExt(file).includes(keyword)));
  return byName.length > 0 ? byName : nodes.filter((file) => fileContainsKeyword(repo, file, keywords));
}

function fileContainsKeyword(repo: string, file: string, keywords: string[]): boolean {
  const content = getFileContent(file, repo);
  return Boolean(content && keywords.some((keyword) => content.toLowerCase().includes(keyword)));
}

function selectActionScanFiles(relevant: string[], nodes: string[]): string[] {
  return relevant.length > 0 ? relevant.slice(0, 5) : nodes.filter((file) => /\.(tsx|jsx|vue)$/.test(file));
}

function extractActionSteps(repo: string, filesToScan: string[]): string[] {
  const actionSteps: string[] = [];
  for (const file of filesToScan) {
    const content = getFileContent(file, repo);
    if (!content) continue;

    addButtonSteps(actionSteps, content);
    addInputSteps(actionSteps, content);
  }
  return actionSteps;
}

function addButtonSteps(actionSteps: string[], content: string): void {
  const btnRegex = /<button\b[\s\S]*?\bonClick\s*=\s*\{[^}]+\}[\s\S]*?>([\s\S]*?)<\/button>/gi;
  let match: RegExpExecArray | null;
  while ((match = btnRegex.exec(content)) !== null) {
    const label = match[1].trim().replace(/\s+/g, " ");
    addActionStep(actionSteps, `Bam nut "${label}"`, label.length > 1 && label.length < 40);
  }
}

function addInputSteps(actionSteps: string[], content: string): void {
  const inputRegex = /placeholder\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = inputRegex.exec(content)) !== null) {
    const placeholder = match[1].trim();
    addActionStep(actionSteps, `Dien "${placeholder}"`, Boolean(placeholder));
  }
}

function addActionStep(actionSteps: string[], step: string, valid: boolean): void {
  if (valid && !actionSteps.includes(step)) actionSteps.push(step);
}

function buildTestSteps(feature: string, actionSteps: string[], relevant: string[]): string[] {
  return [
    `Mo trang ${feature}`,
    ...actionSteps.slice(0, 4),
    ...relevant.slice(0, 2).map((file) => `Kiem tra ${basenameWithoutExt(file)} hien thi dung`),
    "Mo DevTools (F12) kiem tra khong co loi do trong Console",
  ];
}

function buildTestExpectations(actionSteps: string[]): string[] {
  return [
    "Trang load thanh cong, khong trang",
    ...actionSteps.slice(0, 2).map((step) => `${step.replace("Bam nut", "Sau khi bam nut").replace("Dien", "Sau khi dien")} co phan hoi (redirect, toast, hoac UI update)`),
    "Khong co loi do trong Console",
  ];
}
