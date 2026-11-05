import { surfaceAt, type Point } from "./resident-movement.ts";
import { TRAVEL, TRAVEL_LINKS, TRAVEL_NODES, TRAVEL_OBSTACLES } from "./travel-data.ts";
export type TravelLeg = { from: Point; to: Point; motion: "hop" | "climb" };
type Node = Point & { id: string; zone: string };
const distance = (from: Point, to: Point) => Math.hypot(to.x - from.x, to.y - from.y);
const zone = (point: Point) => surfaceAt(point) === "window" ? TRAVEL.groundZone : surfaceAt(point);

function clearFloor(from: Point, to: Point): boolean {
  return TRAVEL_OBSTACLES.every(bounds => {
    const inside = (point: Point) => point.x > bounds.left && point.x < bounds.right && point.y > bounds.back && point.y < bounds.front;
    if (inside(from) || inside(to)) return true;
    let enter = 0, leave = 1;
    for (const [start, change, minimum, maximum] of [
      [from.x, to.x - from.x, bounds.left, bounds.right],
      [from.y, to.y - from.y, bounds.back, bounds.front],
    ] as const) {
      if (change === 0) { if (start < minimum || start > maximum) return true; }
      else {
        const near = (minimum - start) / change, far = (maximum - start) / change;
        enter = Math.max(enter, Math.min(near, far));
        leave = Math.min(leave, Math.max(near, far));
      }
    }
    return enter > leave;
  });
}

function connected(from: Node, to: Node): boolean {
  if (TRAVEL_LINKS.some(([left, right]) => (from.id === left && to.id === right) || (from.id === right && to.id === left))) return true;
  if (from.zone !== to.zone || from.zone === "landing") return false;
  return from.zone !== TRAVEL.groundZone || clearFloor(from, to);
}

export function travelRoute(from: Point, to: Point): TravelLeg[] {
  const nodes: Node[] = [{ ...from, id: "start", zone: zone(from) }, ...TRAVEL_NODES, { ...to, id: "end", zone: zone(to) }];
  const end = nodes.length - 1;
  const costs = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const remaining = new Set(nodes.map((_, index) => index));
  costs[0] = 0;
  while (remaining.size) {
    const current = [...remaining].reduce((best, index) => costs[index]! < costs[best]! ? index : best);
    if (!Number.isFinite(costs[current]) || current === end) break;
    remaining.delete(current);
    for (const next of remaining) {
      if (!connected(nodes[current]!, nodes[next]!)) continue;
      const cost = costs[current]! + distance(nodes[current]!, nodes[next]!);
      if (cost >= costs[next]!) continue;
      costs[next] = cost;
      previous[next] = current;
    }
  }
  if (!Number.isFinite(costs[end])) return [];
  const indices = [end];
  while (indices[0] !== 0) indices.unshift(previous[indices[0]!]!);
  return indices.slice(1).flatMap((index, offset) => {
    const start = nodes[indices[offset]!]!, finish = nodes[index]!;
    if (distance(start, finish) === 0) return [];
    const climb = [start.id, finish.id].includes(TRAVEL.ladderBottom) && [start.id, finish.id].includes(TRAVEL.ladderTop);
    return [{ from: { x: start.x, y: start.y }, to: { x: finish.x, y: finish.y }, motion: climb ? "climb" as const : "hop" as const }];
  });
}
