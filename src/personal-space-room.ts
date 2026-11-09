import { SPACE } from "./personal-space-data.ts";
import { canStand, floorOf, separate, type Occupant, type SpaceBody } from "./personal-space.ts";
import { heightAt, type Resident } from "./resident.ts";
import { surfaceAt } from "./resident-movement.ts";

const occupant = (r: Resident): Occupant => ({ surface: surfaceAt(r.pos), held: r.held, walking: r.walking, paused: r.stopped,
  climbing: r.climbing, posedByPlay: r.posedByPlay });

/** The room's per-frame pass: gives every eligible resident a footprint from its on-screen size, then nudges overlaps
 *  apart. Frozen time (Still, reduced motion, hidden) has dt 0 and moves nobody. Call after features have posed
 *  their residents, since a resident a feature drew this frame has no body. */
export function stepPersonalSpace(residents: readonly Resident[], dt: number): void {
  const bodies: SpaceBody[] = residents.map((r) => ({
    x: r.pos.x, y: r.pos.y, radius: heightAt(r.pos.y, r.cast.sizeBias) * r.aspect * SPACE.radiusRatio,
    floor: floorOf(occupant(r)), heading: r.walking ? r.heading : null,
  }));
  for (const r of residents) r.posedByPlay = false;
  if (dt <= 0) return;
  const shoves = separate(bodies, dt, (i, x, y) => canStand(bodies[i]!.floor!, bodies[i]!, { x, y }));
  shoves.forEach((s, i) => {
    if (s.dx || s.dy) residents[i]!.nudge(s.dx, s.dy, bodies[i]!.radius * SPACE.maxOffset);
  });
}
