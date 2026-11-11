import { IDLE, WORLD } from "./tune.ts";
import { FLOOR_PLAY } from "./floor-play-data.ts";
import { PLACEMENT, LANDING, SURFACES, SURFACE_SPLIT, SEATING_DEPTH, CHAIR_SUPPORT, COUCH_SEAT } from "./resident-movement-data.ts";
export type Point = { x: number; y: number };
export type Frame = { scale: number; left: number; top: number };
export type Surface = keyof typeof SURFACES | "couch";
export const residentSeat = (point: Point, height: number) => ({ height, lift: surfaceAt(point).startsWith("chair-") ? Math.max(0, CHAIR_SUPPORT.headroom - height) : 0 });
const SEATING: Surface[] = ["chair-left", "chair-right", "table", "lounge", "ottoman", "bed-left", "bed-right", "couch"];
const surfaceBounds = (surface: Surface) => surface === "couch" ? COUCH_SEAT : SURFACES[surface];
export const isLoft = (point: Point): boolean => /^(loft|bed)-/.test(surfaceAt(point));
export const isSitting = (point: Point): boolean => SEATING.includes(surfaceAt(point));
export function surfaceAt(point: Point): Surface {
  for (const surface of SEATING) {
    if (surface === "couch" && !COUCH_SEAT.enabled) continue;
    const bounds = surfaceBounds(surface);
    if (point.y < bounds.back || point.y > bounds.front) continue;
    const depth = (point.y - bounds.back) / (bounds.front - bounds.back);
    const left = bounds.backLeft + depth * (bounds.frontLeft - bounds.backLeft);
    const right = bounds.backRight + depth * (bounds.frontRight - bounds.backRight);
    if (point.x >= left && point.x <= right) return surface;
  }
  // The window glass runs from the ceiling to the sill, so a drop anywhere on it settles on the sill, never on the loft.
  if (point.x >= SURFACES.window.frontLeft && point.x <= SURFACES.window.frontRight && point.y <= SURFACES.window.front) return "window";
  if (point.y >= SURFACE_SPLIT.y) return "ground";
  if (point.x < SURFACE_SPLIT.x) return "loft-left";
  // Past the loft's right edge there is no loft, only wall: the drop falls to the ground floor.
  return point.x <= loftRightEdge() ? "loft-right" : "ground";
}
const loftRightEdge = () => Math.max(SURFACES["loft-right"].backRight, SURFACES["loft-right"].frontRight);
export function residentDepth(point: Point, walking = false): number {
  const surface = surfaceAt(point);
  if (surface === "couch") return COUCH_SEAT.depth;
  const approach = COUCH_SEAT.approach;
  if (walking && COUCH_SEAT.enabled && point.x >= approach.left && point.x <= approach.right && point.y >= approach.back && point.y <= approach.front) return Math.max(point.y, COUCH_SEAT.depth);
  if (surface.startsWith("chair-")) return SEATING_DEPTH.chair;
  if (surface === "table" || surface === "lounge" || surface === "ottoman") return SEATING_DEPTH[surface];
  return point.y;
}
export const placementPosition = (point: Point): Point => floorPosition(point, surfaceAt(point));
/** Glass, bare wall and the air above a loft hold nothing: a release there comes to rest on the surface straight below
 *  (the bed or deck upstairs, the window's floor strip, the ground floor). Anywhere else it stays at the shadow. */
export function restingPosition(point: Point): Point {
  const surface = surfaceAt(point);
  if (surface === "window") return floorPosition(point, surface);
  if (SEATING.includes(surface) || point.y >= SURFACE_SPLIT.y) return { ...point };
  const surfaces: Surface[] = ["loft-left", "loft-right", "bed-left", "bed-right"];
  let landing: Point | null = null;
  for (const surface of surfaces) {
    const candidate = supportBelow(point, surface);
    if (candidate && (!landing || candidate.y < landing.y)) landing = candidate;
  }
  return landing ?? floorPosition(point);
}
function supportBelow(point: Point, surface: Surface): Point | null {
  const bounds = surfaceBounds(surface);
  const span = bounds.front - bounds.back;
  let start = Math.max(0, (point.y - bounds.back) / span);
  let end = 1;
  const sides = [
    { back: bounds.backLeft, front: bounds.frontLeft, left: true },
    { back: bounds.backRight, front: bounds.frontRight, left: false },
  ];
  for (const side of sides) {
    const slope = side.front - side.back;
    if (!slope) {
      if (side.left ? point.x < side.back : point.x > side.back) return null;
      continue;
    }
    const crossing = (point.x - side.back) / slope;
    if ((slope > 0) === side.left) end = Math.min(end, crossing);
    else start = Math.max(start, crossing);
  }
  return start <= end ? { x: point.x, y: bounds.back + start * span } : null;
}
/** Height in world px a resident let go at `air` falls to its feet at `landing`: the gap plus the held lift. 0: no fall. */
export const fallDrop = (air: Point, landing: Point, height: number): number => landing.y > air.y ? landing.y - air.y + height * PLACEMENT.lift : 0;
/** Air time of a fall from rest under the gravity thrown residents use. */
export const fallMs = (drop: number): number => Math.sqrt(2 * Math.max(0, drop) / FLOOR_PLAY.gravity) * FLOOR_PLAY.seconds;
/** The fall, then the settle's landing squash at the settle's own pace. */
export const fallEndMs = (drop: number): number => fallMs(drop) + (1 - LANDING.touchDown) * IDLE.pressMs;
export function fallPose(ms: number, drop: number) {
  const air = fallMs(drop);
  if (ms >= air) return landingPose(LANDING.touchDown + (ms - air) / IDLE.pressMs);
  const remaining = 1 - (ms / air) ** 2;
  return { lift: drop * remaining, air: PLACEMENT.air * remaining, sx: 1, sy: 1, rot: 0 };
}
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
  const bounds = surfaceBounds(surface);
  const y = Math.max(bounds.back, Math.min(bounds.front, point.y));
  const depth = (y - bounds.back) / (bounds.front - bounds.back);
  const left = bounds.backLeft + depth * (bounds.frontLeft - bounds.backLeft);
  const right = bounds.backRight + depth * (bounds.frontRight - bounds.backRight);
  return { x: Math.max(left, Math.min(right, point.x)), y };
}
export const worldPoint = (point: Point, frame: Frame): Point => ({ x: (point.x - frame.left) / frame.scale, y: (point.y - frame.top) / frame.scale });
type Grab = { id: string; pointer: number; client: Point; origin: Point; offset: Point; position: Point; moved: boolean };
export class DragPlacement {
  private grab: Grab | null = null;
  get landing(): Point | null { return this.grab ? { ...this.grab.position } : null; }
  begin(id: string, pointer: number, client: Point, world: Point, position: Point): boolean {
    if (this.grab) return false;
    this.grab = { id, pointer, client, origin: { ...position }, position: { ...position }, offset: { x: position.x - world.x, y: position.y - world.y }, moved: false };
    return true;
  }
  /** `carryTop` lets a carried resident rise above the room, to reach the top of a tall pile. */
  move(pointer: number, client: Point, world: Point, _scale = 1, carryTop = 0): Point | null {
    const grab = this.grab;
    if (!grab || grab.pointer !== pointer) return null;
    if (!grab.moved && Math.hypot(client.x - grab.client.x, client.y - grab.client.y) < PLACEMENT.threshold) return null;
    grab.moved = true;
    grab.position = {
      x: Math.max(0, Math.min(WORLD.width, world.x + grab.offset.x)),
      y: Math.max(Math.min(0, carryTop), Math.min(WORLD.height, world.y + grab.offset.y)),
    };
    return { ...grab.position };
  }
  finish(pointer: number, cancel = false): { id: string; moved: boolean; position: Point } | null {
    const grab = this.grab;
    if (!grab || grab.pointer !== pointer) return null;
    const position = cancel ? grab.origin : restingPosition(grab.position);
    this.grab = null;
    return { id: grab.id, moved: grab.moved, position: { ...position } };
  }
}
