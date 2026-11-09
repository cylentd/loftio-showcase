/** Feel tuning for residents stepping around each other. Footprints are flat ellipses on the floor. */
export const SPACE = {
  /** Half the footprint width as a share of the sprite's on-screen width. Copied from floor-play radiusRatio (0.28), so a tossed and a walking resident are the same size. */
  radiusRatio: 0.28,
  /** Floor depth is foreshortened: a footprint is this much shallower than it is wide. Copied from floor-play depthScale (0.4). */
  depthScale: 0.4,
  /** Share of an overlap closed per second. Hand-tuned: about a quarter-second to part two walkers that meet head-on. */
  pushPerS: 6,
  /** Top speed of any push, in footprint radii per second. Hand-tuned so a resident drifts aside and never jumps. */
  maxSpeed: 2.5,
  /** Share of the push an idle resident takes. Hand-tuned: it gives way a little, the walker does the rest. */
  idleYield: 0.4,
  /** Share of the push a walker takes along its heading. Hand-tuned: small, so it keeps its pace. */
  walkerAlong: 0.2,
  /** How far a walker may stray from its path, in footprint radii. Hand-tuned: about one body width. */
  maxOffset: 2,
  /** Per second, how fast a walker's sidestep fades back to its path. Hand-tuned: gone in about a second. */
  decayPerS: 2.5,
  /** A push this close to the heading counts as head-on, and the walker steps to its right. Hand-tuned. */
  headOnTolerance: 0.25,
  /** Milliseconds in a second. */
  seconds: 1000,
} as const;
