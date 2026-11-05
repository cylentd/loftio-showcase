import { HELD } from "./held-pose-data.ts";
export function heldPose(time: number, phase: number, frozen = false) {
  if (frozen || time <= 0) return { rotation: 0, lift: 0, sx: 1, sy: 1 };
  const ease = Math.min(1, time / HELD.easeMs);
  const sway = Math.sin(time / HELD.swayMs * Math.PI * 2 + phase) * ease;
  const bob = Math.sin(time / HELD.bobMs * Math.PI * 2 + phase) * ease;
  return { rotation: HELD.rotation * sway, lift: HELD.lift * bob, sx: 1 + HELD.squash * bob, sy: 1 - HELD.squash * bob };
}
