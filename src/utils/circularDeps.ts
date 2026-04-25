/** Tìm vòng l?p import trong dependency graph b?ng DFS. */
import type { CircularDepsResult } from "../types.js";
import { scanDependencies } from "./scanner.js";

/** Detect circular dependencies in the import graph. */
export async function findCircularDeps(repo: string): Promise<CircularDepsResult> {
  const graph = await (scanDependencies(repo));
  const adj = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }

  const cycles: string[][] = [];
  const seenCycle = new Set<string>();
  const onStack = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    onStack.add(node);
    stack.push(node);
    const neighbors = adj.get(node) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (onStack.has(next)) {
        const idx = stack.indexOf(next);
        if (idx >= 0) {
          const cycle = stack.slice(idx).concat(next);
          const key = [...cycle].sort().join("|");
          if (!seenCycle.has(key)) {
            seenCycle.add(key);
            cycles.push(cycle);
          }
        }
      }
    }
    stack.pop();
    onStack.delete(node);
  }

  for (const node of graph.nodes) {
    if (!visited.has(node)) dfs(node);
  }

  const summary = cycles.length === 0
    ? "Khong co import cycle nao."
    : "Phat hien " + cycles.length + " import cycle. Cycle dau tien: " + cycles[0].join(" -> ");
  return { cycleCount: cycles.length, cycles: cycles.slice(0, 10), summary };
}
