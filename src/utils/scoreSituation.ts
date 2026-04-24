/** Escape regex meta-characters trong keyword để dùng trong RegExp constructor. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Tìm các keyword match trong situation. */
export function matchKeywords(situation: string, keywords: string[]): string[] {
  const lower = situation.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    let isMatch = false;
    if (/\s/.test(k)) {
      isMatch = lower.includes(k);
    } else {
      const re = new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRegex(k)}(?:[^\\p{L}\\p{N}_]|$)`, "u");
      isMatch = re.test(lower);
    }
    if (isMatch) matched.push(kw);
  }
  return matched;
}

/** Tính điểm match giữa situation và keywords.
 *  Single tokens (no whitespace) match on word boundaries to avoid 'ui' matching 'tooling'.
 *  Multi-word phrases use plain substring matching (whitespace already isolates them). */
export function scoreSituation(situation: string, keywords: string[]): number {
  const hits = matchKeywords(situation, keywords).length;
  if (hits === 0) return 0;
  // Normalize: nhiều keyword match → confidence cao hơn nhưng saturate ở ~0.95
  return Math.min(0.95, 0.4 + hits * 0.15);
}
