import { normalizeFillBlankAnswer } from "./scoring";

/** Tiles are distinct instances: repeated words may be used up to their bank count. */
export function canConstructArrangement(answer: string, tiles: string[]): boolean {
  const target = normalizeFillBlankAnswer(answer);
  const bank = new Map<string, number>();
  for (const text of tiles) {
    const tile = normalizeFillBlankAnswer(text);
    if (!tile) return false;
    bank.set(tile, (bank.get(tile) ?? 0) + 1);
  }
  if (!target || bank.size === 0) return false;
  const words = [...bank.keys()];
  const counts = [...bank.values()];
  const failed = new Set<string>();
  function visit(offset: number): boolean {
    if (offset === target.length) return true;
    const state = `${offset}:${counts.join(",")}`;
    if (failed.has(state)) return false;
    for (let i = 0; i < words.length; i++) {
      const end = offset + words[i].length;
      if (counts[i] === 0 || !target.startsWith(words[i], offset) || (end < target.length && target[end] !== " ")) continue;
      counts[i]--;
      const found = visit(end === target.length ? end : end + 1);
      counts[i]++;
      if (found) return true;
    }
    failed.add(state);
    return false;
  }
  return visit(0);
}
