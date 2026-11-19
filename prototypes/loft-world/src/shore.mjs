// The island's edge: where the valley's land ends over the cloud sea, the wind that turns a glider back, and the lift out of the clouds.
// Pure functions of position, no three.js, so terrain.js, the planner and play.js all read the same shore.

/** The shore line, by direction. mid ± amp is the range (318..362). Each wave: [harmonic, weight, phase]; integer harmonics
 * make it close on itself all the way round, weights sum to 1 so the sum stays within ±1. Phases picked by eye on the
 * top-down capture (2026-11-18, when the island was 172..190 across). The island grew (owner, 2026-11-18: "it should be way
 * more vast ... we had rolling hills before"): mid 340 keeps the old rolling hills out past 300; amp 22 keeps the same share
 * of bays and headlands as the old 9 on 181. */
export const SHORE = {
  mid: 340, amp: 22,
  waves: [[3, 0.4, 0.4], [5, 0.3, 2.6], [8, 0.2, 4.1], [13, 0.1, 1.3]],
  lipIn: 10, // the land rounds over a lip this far inside the shore line
  footOut: 12, // and has dropped under the cloud sea this far outside it
};

/** Shore radius in world units for the direction of (x, z) from the valley centre. */
export function shoreRadius(x, z) {
  const a = Math.atan2(z, x);
  let s = 0;
  for (const [k, w, p] of SHORE.waves) s += w * Math.sin(k * a + p);
  return SHORE.mid + SHORE.amp * s;
}

/** The wind leash: free for `free` units past the shore, then an inward pull growing linearly, reaching `full` after `ramp` more. */
export const LEASH = { free: 12, ramp: 20, full: 60 }; // full: the old fixed leash's 60, now reached 32 past the shore

/** Inward acceleration (units/s², along the direction to the centre) at (x, z). */
export function leashPull(x, z) {
  const over = Math.hypot(x, z) - shoreRadius(x, z) - LEASH.free;
  return over > 0 ? LEASH.full * over / LEASH.ramp : 0;
}

/** Falling into the cloud sea: below `below` (world height) a body is lifted back to land `inside` units in from the lip,
 * `lift` above the ground, moving up at `up`. below sits under the cloud sea (world.js SEA_Y -18), so the clouds hide the swap. */
export const RESCUE = { below: -26, inside: 10, lift: 1.5, up: 16 };

/** The rescue landing point [x, z] for a body at (x, z): same direction, RESCUE.inside in from the lip. */
export function rescueSpot(x, z) {
  const a = Math.atan2(z, x), r = shoreRadius(x, z) - SHORE.lipIn - RESCUE.inside;
  return [Math.cos(a) * r, Math.sin(a) * r];
}
