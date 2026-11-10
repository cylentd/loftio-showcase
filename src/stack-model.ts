import { STACK } from "./stack-data.ts";
export type StackTarget = { id: string; x: number; y: number; lift: number; height: number; width: number; count: number };
export function chooseStack(foot: { x: number; y: number }, candidates: StackTarget[], includeFull = false): string | null {
  let closest: string | null = null, score = Infinity;
  for (const c of candidates) {
    if (!includeFull && c.count >= STACK.maxResidents) continue;
    const dx = Math.abs(foot.x - c.x), dy = Math.abs(foot.y - (c.y - c.lift - c.height * STACK.supportHeight));
    if (dx > Math.max(STACK.minTarget, c.width * STACK.catchWidth) || dy > Math.max(STACK.minTarget, c.height * STACK.catchHeight)) continue;
    if (dx + dy < score) { score = dx + dy; closest = c.id; }
  }
  return closest;
}
export function splitStack<T>(members: readonly T[], index: number): { lower: T[]; falling: T[] } {
  return { lower: members.slice(0, index), falling: members.slice(index + 1) };
}
