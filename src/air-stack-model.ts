import type { FloorBody } from "./floor-play-model.ts";
import type { StackTarget } from "./stack-model.ts";
import { STACK } from "./stack-data.ts";
import { FLOOR_PLAY } from "./floor-play-data.ts";

/** Swept feet/head crossing, with local assistance and a separate floor-depth gate. */
export function airborneStack(previous: FloorBody, current: FloorBody, targets: StackTarget[]): string | null {
  if (current.vz >= 0) return null;
  const speed = (b: FloorBody) => Math.hypot(b.vx, b.vy / FLOOR_PLAY.depthScale);
  if (Math.max(speed(previous), speed(current)) > STACK.airMaxSpeed) return null;
  const start = previous.y - previous.z, end = current.y - current.z;
  if (end <= start) return null;
  let chosen: string | null = null, firstCrossing = Infinity;
  for (const target of targets) {
    if (target.count >= STACK.maxResidents) continue;
    const surface = target.y - target.lift - target.height * STACK.supportHeight;
    if (start > surface || end < surface) continue;
    const crossing = (surface - start) / (end - start);
    const x = previous.x + (current.x - previous.x) * crossing;
    const y = previous.y + (current.y - previous.y) * crossing;
    if (Math.abs(x - target.x) > Math.max(STACK.minTarget, target.width * STACK.airWidth)) continue;
    if (Math.abs(y - target.y) > STACK.airDepth) continue;
    if (crossing < firstCrossing) { firstCrossing = crossing; chosen = target.id; }
  }
  return chosen;
}
