/** Output shaping for MCP tool responses. */

/** Compress output to fit context budget by truncating arrays and removing verbose fields. */
export function compressOutput(result: unknown, maxChars: number): string {
  if (typeof result === "string") return result.slice(0, maxChars) + "\n... [truncated]";

  const compressed = compressObject(result as Record<string, unknown>);
  let output = JSON.stringify(compressed, null, 2);
  if (output.length > maxChars) {
    output = output.slice(0, maxChars) + "\n... [output truncated to fit context budget]";
  }
  return output;
}

function compressObject(obj: Record<string, unknown>): Record<string, unknown> {
  const compressed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    compressed[key] = compressValue(key, value, compressed);
  }
  return compressed;
}

function compressValue(key: string, value: unknown, metadataTarget: Record<string, unknown>): unknown {
  if (Array.isArray(value)) return compressArray(key, value, metadataTarget);
  if (typeof value === "object" && value !== null) return compressNestedObject(key, value as Record<string, unknown>, metadataTarget);
  return value;
}

function compressArray(key: string, value: unknown[], metadataTarget: Record<string, unknown>): unknown[] {
  if (value.length <= 10) return value;
  metadataTarget[`${key}Total`] = value.length;
  metadataTarget[`${key}Note`] = `Showing top 10 of ${value.length}. Use specific tool to see more.`;
  return value.slice(0, 10);
}

function compressNestedObject(key: string, value: Record<string, unknown>, metadataTarget: Record<string, unknown>): unknown {
  const subJson = JSON.stringify(value);
  if (subJson.length <= 500) return value;
  metadataTarget[`${key}Keys`] = Object.keys(value).slice(0, 10);
  return `{ ... truncated (${Object.keys(value).length} keys) }`;
}
