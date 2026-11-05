import { EFFECTS, GLASS } from "./effects-constants.ts";
import { WORLD } from "./tune.ts";

export type Point = { x: number; y: number };
export type Motion = { still: boolean; reduced: boolean; hidden: boolean; scene: boolean };
export function motionStep(dt: number, prefs: Motion): number {
  return prefs.still || prefs.reduced || prefs.hidden || !prefs.scene || !Number.isFinite(dt)
    ? 0 : Math.max(0, Math.min(EFFECTS.maxDelta, dt));
}
export function cameraOffset(point: Point, width: number, height: number, scale: number): Point {
  const slackX = Math.max(0, (WORLD.width - width / scale) / 2);
  const slackY = Math.max(0, (WORLD.height - height / scale) / 2);
  const x = Math.max(-1, Math.min(1, point.x)) * Math.min(EFFECTS.cameraX, slackX);
  const y = Math.max(-1, Math.min(1, point.y)) * Math.min(EFFECTS.cameraY, slackY);
  return { x: x || 0, y: y || 0 };
}
export function onGlass(point: Point): boolean {
  return GLASS.some((polygon) => withinPolygon(point, polygon));
}
export function withinPolygon(point: Point, polygon: readonly number[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
      const ax = polygon[i]!, ay = polygon[i + 1]!, bx = polygon[j]!, by = polygon[j + 1]!;
      if ((ay > point.y) !== (by > point.y) && point.x < (bx - ax) * (point.y - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside;
}
export function leafWeight(u: number, v: number): number {
  if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0;
  return Math.sin(Math.PI * u) ** 2 * Math.sin(Math.PI * v) ** 2 * v * 2;
}
export function rainPosition(seed: number, time: number, near: boolean): Point {
  const speed = near ? EFFECTS.nearSpeed : EFFECTS.farSpeed;
  const y = (seed * EFFECTS.rainSpan + time * speed) % EFFECTS.rainSpan - EFFECTS.rainTop;
  return { x: EFFECTS.rainLeft + ((seed * EFFECTS.rainSeedStride) % 1) * EFFECTS.rainWidth - y * EFFECTS.rainAngle, y };
}
