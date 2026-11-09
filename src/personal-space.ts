import { SPACE } from "./personal-space-data.ts";
import { floorPosition, surfaceAt, type Point, type Surface } from "./resident-movement.ts";
import { TRAVEL_OBSTACLES } from "./travel-data.ts";
import { WORLD } from "./tune.ts";

/** What the pass needs to know about one resident to give it a body, or none. */
export type Occupant = { surface: string; held: boolean; walking: boolean; paused: boolean; climbing: boolean; posedByPlay: boolean };
/** One footprint: feet position, half-width, the floor it stands on (null: no body) and its walking direction (null: idle). */
export type SpaceBody = { x: number; y: number; radius: number; floor: string | null; heading: Point | null };
export type Shove = { dx: number; dy: number };

const NONE: Shove = { dx: 0, dy: 0 };
const TINY = 1e-6;

/** The open floor a resident stands on, or null when it has no body: held, seated, on a bed or chair or the table,
 *  on a ladder leg, paused, or drawn by a feature (mid-toss, in a pile). Ground and each loft are separate floors. */
export function floorOf(o: Occupant): string | null {
  if (o.held || o.paused || o.climbing || o.posedByPlay) return null;
  return o.surface === "ground" || o.surface.startsWith("loft-") ? o.surface : null;
}

const norm = (x: number, y: number) => ({ x, y: y / SPACE.depthScale });
const length = (v: Point) => Math.hypot(v.x, v.y);

/** How the body at `i` is pushed by its neighbour away along `away` (a unit vector in footprint space). */
function share(b: SpaceBody, away: Point, amount: number): Point {
  if (!b.heading) return { x: away.x * amount * SPACE.idleYield, y: away.y * amount * SPACE.idleYield };
  const h = norm(b.heading.x, b.heading.y), size = length(h) || 1;
  const along = { x: h.x / size, y: h.y / size };
  const right = { x: -along.y, y: along.x };
  const side = away.x * right.x + away.y * right.y;
  const sign = Math.abs(side) < SPACE.headOnTolerance ? 1 : Math.sign(side);
  const ahead = (away.x * along.x + away.y * along.y) * SPACE.walkerAlong;
  return { x: (right.x * sign + along.x * ahead) * amount, y: (right.y * sign + along.y * ahead) * amount };
}

/** A gentle push apart for every overlapping pair on the same floor. A walker steps to the side of its heading (its
 *  own right when head-on), an idle resident gives way a little. Each push is capped per step and dropped when
 *  `stand` refuses where it would land. Returns one displacement per body, in world px. */
export function separate(bodies: readonly SpaceBody[], dt: number, stand: (i: number, x: number, y: number) => boolean = () => true): Shove[] {
  const seconds = Math.max(0, dt) / SPACE.seconds;
  const sum = bodies.map(() => ({ x: 0, y: 0 }));
  for (let i = 0; i < bodies.length; i += 1) for (let j = i + 1; j < bodies.length; j += 1) {
    const a = bodies[i]!, b = bodies[j]!;
    if (!a.floor || a.floor !== b.floor) continue;
    const between = norm(b.x - a.x, b.y - a.y), distance = length(between), reach = a.radius + b.radius;
    if (distance >= reach) continue;
    const toward = distance > TINY ? { x: between.x / distance, y: between.y / distance } : { x: 1, y: 0 };
    const amount = (reach - distance) * Math.min(1, SPACE.pushPerS * seconds);
    const pa = share(a, { x: -toward.x, y: -toward.y }, amount), pb = share(b, toward, amount);
    sum[i]!.x += pa.x; sum[i]!.y += pa.y; sum[j]!.x += pb.x; sum[j]!.y += pb.y;
  }
  return bodies.map((b, i) => {
    const push = sum[i]!, size = length(push);
    if (!size) return NONE;
    const cap = b.radius * SPACE.maxSpeed * seconds;
    const k = size > cap ? cap / size : 1;
    const shove = { dx: push.x * k, dy: push.y * k * SPACE.depthScale };
    return stand(i, b.x + shove.dx, b.y + shove.dy) ? shove : NONE;
  });
}

const insideObstacle = (p: Point) => TRAVEL_OBSTACLES.some((o) => p.x > o.left && p.x < o.right && p.y > o.back && p.y < o.front);
const strayFrom = (p: Point, surface: Surface) => { const c = floorPosition(p, surface); return Math.hypot(p.x - c.x, p.y - c.y); };

/** Whether a push from `from` to `to` keeps the resident on its own floor, inside the world and out of the table
 *  footprints. A resident already off the polygon edge (a back-row node) may only move toward it. */
export function canStand(floor: string, from: Point, to: Point): boolean {
  if (to.x < 0 || to.y < 0 || to.x > WORLD.width || to.y > WORLD.height) return false;
  if (surfaceAt(to) !== floor) return false;
  if (insideObstacle(to) && !insideObstacle(from)) return false;
  return strayFrom(to, floor as Surface) <= strayFrom(from, floor as Surface) + TINY;
}
