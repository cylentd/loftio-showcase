import { floorPosition, surfaceAt, isLoft, type Point } from "./resident-movement.ts";
import { WANDER, WANDER_DESTINATIONS } from "./resident-movement-data.ts";
export const canWander = (enabled: boolean, held: boolean, walking: boolean, now: number, after: number, foregroundCue = false): boolean => enabled && !held && !walking && !foregroundCue && now >= after;
export function wanderTarget(home: Point, interest: Point, at: string, random: number, explore = false): Point {
  if (at === "interest") return { ...home };
  if (explore) {
    const destinations = [interest, ...WANDER_DESTINATIONS];
    return { ...destinations[Math.min(destinations.length - 1, Math.floor(random * destinations.length))]! };
  }
  const surface = surfaceAt(home);
  if (surface === "ground" && !isLoft(interest)) return { ...interest };
  if (surface === surfaceAt(interest)) return { ...interest };
  return floorPosition({ x: home.x + (random * 2 - 1) * WANDER.loftRangeX, y: home.y + (0.5 - random) * WANDER.loftRangeY }, surface);
}
