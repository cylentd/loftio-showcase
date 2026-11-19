// Cherry petals: every number the falling and fallen petals use, in world units and seconds.
import {MEADOW_LOOK} from './terrain-look-data.mjs';

/** Petals per cherry tree, per mode (mode-data.mjs names). A mode missing here (anything below phone) gets none. */
export const PETAL_BUDGET = {
  // Raised 2026-11-18 (was 14/40 and 5/12): at the first counts the grove showed a few pale specks. 46 trees on desktop,
  // so about 1800 in the air and 4100 on the ground; 21 trees on phone.
  // falling cut from 40 to 12 (phone 14 to 5), owner 2026-11-18: "too many petals. There can be this many if there was a gust of wind but there isnt".
  showpiece: { falling: 12, fallen: 90 },
  high: { falling: 12, fallen: 90 },
  phone: { falling: 5, fallen: 30 },
};

/** Where a cherry crown sits. A cherry instance is CHERRY_HEIGHT tall before treeVariety's height and width multipliers.
 *  The crown agent may reshape the cherry crown (flora.js, tree-clay*.mjs): recheck these two shares when it does. */
export const CHERRY_CROWN = {
  height: 7,        // the cherry kind's base height (world.js kinds)
  centerShare: 0.78, // crown centre, as a share of the scaled height above the tree's ground point (measured on the reshaped crown, 2026-11-18)
  radius: 5.5,       // crown radius per unit of treeVariety width (the reshaped crown is 0.84 of the height, 5.9; a little inside it)
  startShare: 0.85, // petals start inside this share of the crown radius, so none begins outside the leaves
};

/** Falling petals: how they leave the crown and come down. */
export const PETAL_FALL = {
  speed: 0.6,         // units per second straight down (brief)
  speedSpread: 0.35,  // each petal's speed is speed times 1 plus or minus this share
  sway: 0.28,         // side-to-side reach of the flutter, units
  swaySpread: 0.5,    // each petal's sway is sway times 1 plus or minus this share
  swayRate: 1.5,      // flutter in radians per second
  drift: 0.35,        // units per second carried along the wind at wind strength 1
  spin: [1.6, 3.4],   // tumble rates of the two axes, radians per second (low, high)
  growSeconds: 0.6,   // a new petal grows from nothing over this long, so it does not pop out of the crown
  shrinkDrop: 0.7,    // and shrinks to nothing over its last this-many units of drop, so it never pokes through the ground
};

/** Fallen petals: flat on the ground under each crown. */
export const PETAL_GROUND = {
  spread: 1.1,     // scattered out to this share of the crown radius around the trunk
  downwind: 1.8,   // and pushed up to this many units further along the wind
  lift: 0.03,      // above heightAt, so they do not z-fight with the ground
  grassLift: 0.3,  // extra where the ground is grass (not path or sand): they rest on the blades (0.4 to 1.1 tall, MEADOW_LOOK) instead of under them
  tilt: 0.25,      // a fallen petal leans up to this many radians, so the litter does not read as decals
};

/** Shared look of both meshes. */
export const PETAL_LOOK = {
  length: 0.26,                // petal length, units (was .14: six pixels at 14 units, it read as dust)
  width: 0.19,                 // petal width, units
  fold: 0.01,                  // how far the edges lift above the midrib, units: a shallow cup, not a crease
  // Right half of the outline, base to tip, as [share of half-width, share of length from the middle]. Mirrored for
  // the left half. Narrow at the base, widest past the middle, with the small notch a cherry petal has at its tip.
  outline: [[0, -0.5], [0.45, -0.3], [0.9, 0], [0.95, 0.22], [0.7, 0.42], [0.3, 0.5], [0, 0.42]],
  tip: [0.95, 0.58, 0.72],     // albedo at the outer edge: pink, kept under 1 so the sun never blooms it (was paler: in sun it read as paper scraps)
  base: [0.84, 0.36, 0.55],    // albedo at the petal's base: a deeper pink
  tintSpread: 0.45,            // per petal: up to this share of the way from pink toward pale pink
  white: [0.96, 0.76, 0.83],   // the pale end of that spread
  backLight: 0.2,            // a thin petal lets this share of the light through from behind
  fadeNear: 55,                // petals start to shrink this far from the camera
  fadeFar: 70,                 // and are gone at this distance (brief)
};

/** The wind direction the grass bends toward (terrain-look-data.mjs), so petals drift the same way. */
export const PETAL_WIND_DIR = MEADOW_LOOK.windDir;
/** Seeds: one per mesh, so the two never share a pattern. */
export const PETAL_SEED = { falling: 811, fallen: 2203 };
