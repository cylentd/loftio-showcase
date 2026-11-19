// Every number the woodland planner uses, named. Units are world units (the island is about 680 across) unless said otherwise.
import { SHORE } from './shore.mjs';

/** Seed of the planner's own random stream: any value; fixed so the valley is the same on every load. */
export const WOODS_SEED = 4417;

/** Share of the wanted trees each stage spends first. Backdrop takes the rest and anything the others could not place. */
export const SHARE = { gates: 0.03, groves: 0.62, specimens: 0.05 }; // owner's brief 2026-11-18

/** Tries per tree wanted, and tries per grove centre, before a stage gives up and hands its trees on. */
export const TRIES = { perTree: 40, perCentre: 400 }; // brief: attempt caps so no loop can run away

/** Smallest trunk gap per kind. A pair keeps the larger of its two values. */
export const SPACING = { canopy: 5.5, cone: 4, column: 3.5, umbrella: 5, cherry: 5.5, pine: 3.5 }; // brief; canopy crowns are widest, umbrella and cherry crowns spread wide

/** Share of the green (non-lake, non-pine) groves that take each kind. Sums to 1. */
export const GREEN_SHARE = { canopy: 0.35, cone: 0.25, column: 0.15, umbrella: 0.25 }; // owner's brief 2026-11-18: more, clearly different green shapes

/** Ground a tree may stand on. Height is above sea level; the old scatter used the same limits. */
export const GROUND = {
  waterMargin: 1.5, // trees stay this far above the water surface
  seaMargin: 16, // trees stay this far above the cloud sea (input `sea`); with the sea at -18, trees stand above -2, on the island's top and off its cliff face
  maxHeight: 62, // above this the ground is bare rock
  maxSand: 0.2, // mask values above these count as sand or creek bed
  maxWet: 0.01,
  pathKeepOff: 5, // no tree this close to a path centre line
};

/** Corridors kept open: [x1, z1, x2, z2, half-width]. Start to loft, and loft to the lake centre. */
export const SIGHTLINES = [
  [18, 22, 3.6, 0.4, 7], // where the player arrives, to the loft
  [3.6, 0.4, 85, 25, 7], // the loft, to the lake centre (LAND.lake)
];

/** Path gates: pairs of canopy trees facing each other across a path. */
export const GATES = { every: 40, firstAt: 20, offset: 6.5, kind: 'canopy' }; // brief: a pair every ~40 along each path

/** Grove layout. */
export const GROVES = {
  minTrees: 8, // a grove needs this many trees to read as a grove, so a small budget (phone) gets fewer groves, not thinner ones
  centreGap: 42, // minimum distance between grove centres
  reach: 135, // centres lie within this of the origin
  playedReach: 110, // about two thirds of the centres lie within this
  playedShare: 2 / 3,
  radius: [12, 26], // min and max grove radius
  pineAbove: 26, // ground height at the centre that makes a pine grove
  waterSide: 22, // centre within this of the lake shore makes a cherry grove
  kindShare: 0.85, // share of a grove's trees that are its own kind; the rest are one companion kind
  coreExponent: 0.75, // sampled radius is r * u^exponent: denser core, loose fringe
  innerRing: 0.5, // no sapling inside this share of the radius
  outerRing: 0.8, // no tall or giant outside this share of the radius
};

/** Cherry groves planted on purpose around the lake, before any grove is thrown at random: one random lake grove of six trees
 * did not make a place (2026-11-18). angles: direction from the lake centre, radians (0 = +x, a quarter turn = +z), chosen on the
 * map: north of the loft's view of the lake, across the cafe path (the path runs through it as a lane), and the far shore.
 * ring: centre distance as a multiple of the lake radius, past the sand. radius: grove radius. */
export const CHERRY_SHORE = { angles: [3.75, 2.62, 6.1], ring: 1.75, radius: 18 };

/** The woods keep this far from the centre of each village home. */
export const HOME_KEEP_CLEAR = 7; // brief: the eight homes get a radius-7 clear circle

/** Per-spot numbers world.js derives from a planned position (the old scatter drew them from its random stream). */
export const SPOT = {
  size: { min: 0.8, span: 0.6 }, // a tree's size factor: 0.8 to 1.4, as before
  pine: { base: 7, span: 6 }, // a pine's scale before the size class: 7 to 13, as before
  hash: { x: 12.9898, z: 78.233, amp: 43758.5453 }, // the classic sin-fract position hash
};

/** Backdrop: pines (and some cones) on the outer hills beyond the played valley, in groves where the density noise is high.
 * to: the widest cliff lip (shore.mjs mid + amp - lipIn); the planner's sea rule trims each direction to its own lip. (Was 180, when the island ended at 190.) */
export const BACKDROP = { from: 150, to: SHORE.mid + SHORE.amp - SHORE.lipIn,
 coneShare: 0.25, minDensity: 0.56 }; // minDensity: 0.5 scattered the larger outer budget thinly over the hills; 0.56 gathers it into groves with open grass between (step14 captures)

/** Specimens: single canopy trees on high points, in the open. */
export const SPECIMEN = { apart: 18, reach: 120, probe: 8, kind: 'canopy' }; // probe: ground 8 units away in four directions must be lower
