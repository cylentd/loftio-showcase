import { GRAB as G } from "./grab-data.ts";
export type GrabState = { x: number; y: number; vx: number; vy: number; caught: number };
export function grabState(caught = false): GrabState { return { x: 0, y: 0, vx: 0, vy: 0, caught: caught ? 1 : 0 }; }
export function pullGrab(s: GrabState, dx: number, dy: number, height: number): void {
  const gain = G.gain / Math.max(1, height);
  s.x = Math.max(-G.limit, Math.min(G.limit, s.x + dx * gain));
  s.y = Math.max(-G.limit, Math.min(G.limit, s.y + dy * gain));
}
export function advanceGrab(s: GrabState, milliseconds: number): void {
  let remaining = Math.max(0, Math.min(G.maxFrameMs, milliseconds));
  s.caught = Math.max(0, s.caught - remaining / G.catchMs);
  while (remaining > 0) {
    const step = Math.min(G.stepMs, remaining); remaining -= step;
    const dt = step / G.seconds;
    s.vx += (-G.stiffness * s.x - G.damping * s.vx) * dt;
    s.vy += (-G.stiffness * s.y - G.damping * s.vy) * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
  }
}
export function grabPose(s: GrabState, frozen = false) {
  if (frozen) return { sx: 1, sy: 1, rotation: 0 };
  const x = Math.min(G.limit, Math.abs(s.x)), y = Math.min(G.limit, Math.abs(s.y));
  const squish = s.caught * s.caught * G.catchSquash;
  return { sx: 1 + x * G.stretch - y * G.compress + squish,
    sy: 1 + y * G.stretch - x * G.compress - squish, rotation: s.x * G.lean };
}
