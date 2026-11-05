import { PLACEMENT, LANDING, SURFACES, SURFACE_SPLIT, SEATING_DEPTH, CHAIR_HEADROOM, DRAG_TARGET } from "./resident-movement-data.ts";
export type Point = { x: number; y: number };
export type Frame = { scale: number; left: number; top: number };
export type Surface = keyof typeof SURFACES;
export const residentSeat = (point: Point, height: number) => ({ height, lift: surfaceAt(point).startsWith("chair-") ? Math.max(0, CHAIR_HEADROOM - height) : 0 });
const SEATING: Surface[] = ["chair-left", "chair-right", "table", "lounge", "ottoman", "bed-left", "bed-right"];
export const isLoft = (point: Point): boolean => /^(loft|bed)-/.test(surfaceAt(point));
export const isSitting = (point: Point): boolean => SEATING.includes(surfaceAt(point));
export function surfaceAt(point: Point): Surface {
  for (const surface of SEATING) {
    const bounds = SURFACES[surface];
    if (point.y >= bounds.back && point.y <= bounds.front && point.x >= Math.min(bounds.backLeft, bounds.frontLeft) && point.x <= Math.max(bounds.backRight, bounds.frontRight)) return surface;
  }
  if (point.x >= SURFACES.window.frontLeft && point.x <= SURFACES.window.frontRight && point.y >= SURFACE_SPLIT.y && point.y <= SURFACES.window.front) return "window";
  return point.y >= SURFACE_SPLIT.y ? "ground" : point.x < SURFACE_SPLIT.x ? "loft-left" : "loft-right";
}
export function residentDepth(point: Point): number {
  const surface = surfaceAt(point);
  if (surface.startsWith("chair-")) return SEATING_DEPTH.chair;
  if (surface === "table" || surface === "lounge" || surface === "ottoman") return SEATING_DEPTH[surface];
  return point.y;
}
export const placementPosition = (point: Point): Point => floorPosition(point, surfaceAt(point));
export function landingPose(progress: number) {
  const rest = { lift: 0, air: 0, sx: 1, sy: 1, rot: 0 };
  if (progress >= 1) return rest;
  if (progress < LANDING.touchDown) {
    const remaining = 1 - Math.max(0, progress) / LANDING.touchDown;
    return { ...rest, lift: PLACEMENT.lift * remaining ** 2, air: PLACEMENT.air * remaining };
  }
  const wave = Math.sin((progress - LANDING.touchDown) / (1 - LANDING.touchDown) * Math.PI);
  return { ...rest, sx: 1 + LANDING.squashX * wave, sy: 1 - LANDING.squashY * wave };
}
export function floorPosition(point: Point, surface: Surface = "ground"): Point {
  const bounds = SURFACES[surface];
  const y = Math.max(bounds.back, Math.min(bounds.front, point.y));
  const depth = (y - bounds.back) / (bounds.front - bounds.back);
  const left = bounds.backLeft + depth * (bounds.frontLeft - bounds.backLeft);
  const right = bounds.backRight + depth * (bounds.frontRight - bounds.backRight);
  return { x: Math.max(left, Math.min(right, point.x)), y };
}
export const worldPoint = (point: Point, frame: Frame): Point => ({ x: (point.x - frame.left) / frame.scale, y: (point.y - frame.top) / frame.scale });
type Grab = { id: string; pointer: number; client: Point; origin: Point; offset: Point; position: Point; moved: boolean };
const SURFACE_NAMES = Object.keys(SURFACES) as Surface[];
const CARRY_BOUNDS = {
  left: Math.min(...Object.values(SURFACES).flatMap(bounds => [bounds.backLeft, bounds.frontLeft])),
  right: Math.max(...Object.values(SURFACES).flatMap(bounds => [bounds.backRight, bounds.frontRight])),
  top: Math.min(...Object.values(SURFACES).map(bounds => bounds.back)),
  bottom: Math.max(...Object.values(SURFACES).map(bounds => bounds.front)),
};
function closestLanding(point: Point, scale: number, previous: Surface | null): Surface {
  const distance = (surface: Surface) => {
    const target = floorPosition(point, surface);
    return Math.hypot(point.x - target.x, point.y - target.y);
  };
  const screenScale = Math.max(DRAG_TARGET.minimumScale, scale);
  const candidates = SURFACE_NAMES.filter(surface => !SEATING.includes(surface) || distance(surface) * screenScale <= DRAG_TARGET.seatCapturePixels);
  const best = candidates.reduce((nearest, surface) => distance(surface) < distance(nearest) ? surface : nearest);
  const margin = DRAG_TARGET.switchMarginPixels / screenScale;
  return previous !== null && distance(previous) <= distance(best) + margin ? previous : best;
}
export class DragPlacement {
  private grab: Grab | null = null;
  private target: Surface | null = null;
  get landing(): Point | null { return this.grab && this.target ? floorPosition(this.grab.position, this.target) : null; }
  begin(id: string, pointer: number, client: Point, world: Point, position: Point): boolean {
    if (this.grab) return false;
    this.target = null;
    this.grab = { id, pointer, client, origin: { ...position }, position: { ...position }, offset: { x: position.x - world.x, y: position.y - world.y }, moved: false };
    return true;
  }
  move(pointer: number, client: Point, world: Point, scale = 1): Point | null {
    const grab = this.grab;
    if (!grab || grab.pointer !== pointer) return null;
    if (!grab.moved && Math.hypot(client.x - grab.client.x, client.y - grab.client.y) < PLACEMENT.threshold) return null;
    grab.moved = true;
    grab.position = {
      x: Math.max(CARRY_BOUNDS.left, Math.min(CARRY_BOUNDS.right, world.x + grab.offset.x)),
      y: Math.max(CARRY_BOUNDS.top, Math.min(CARRY_BOUNDS.bottom, world.y + grab.offset.y)),
    };
    this.target = closestLanding(grab.position, scale, this.target);
    return { ...grab.position };
  }
  finish(pointer: number, cancel = false): { id: string; moved: boolean; position: Point } | null {
    const grab = this.grab;
    if (!grab || grab.pointer !== pointer) return null;
    const position = cancel ? grab.origin : this.landing ?? grab.position;
    this.grab = null; this.target = null;
    return { id: grab.id, moved: grab.moved, position: { ...position } };
  }
}
