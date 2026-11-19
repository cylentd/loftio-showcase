// Cherry petals, pure: where each falling petal starts and how it moves, and where each fallen petal lies. No three.js.
import {treeVariety} from './tree-variety.mjs';
import {PETAL_BUDGET,CHERRY_CROWN,PETAL_FALL,PETAL_GROUND,PETAL_WIND_DIR} from './petals-data.mjs';

const TURN = Math.PI * 2;
const NONE = { falling: 0, fallen: 0 };

/** Seeded generator (mulberry32): the same seed gives the same petals on every load. */
function random(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const spread = (rand, share) => 1 + (rand() * 2 - 1) * share;

/** Petals per tree for a mode name; a mode without a row gets none. */
export const petalBudget = (modeName) => PETAL_BUDGET[modeName] ?? NONE;

/** The crown sphere of the cherry at spot [x, groundY, z, size]: centre and radius. */
export function crownOf([x, y, z]) {
  const v = treeVariety(x, z);
  return { x, y: y + CHERRY_CROWN.height * v.height * CHERRY_CROWN.centerShare, z, r: CHERRY_CROWN.radius * v.width };
}

/** How far from the trunk a fallen petal of this tree may lie. */
export const fallenReach = (spot) => crownOf(spot).r * PETAL_GROUND.spread + PETAL_GROUND.downwind;

/** A uniform point inside a ball of radius r (rejection keeps it uniform and simple). */
function inBall(rand, r) {
  for (;;) {
    const p = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
    if (p[0] * p[0] + p[1] * p[1] + p[2] * p[2] <= 1) return p.map((c) => c * r);
  }
}

/**
 * Per-instance arrays for the falling petals: start point (xyz), phase 0..1 in its loop, fall speed, sway reach,
 * drop (start height above the tree's ground) and tint 0..1.
 */
export function petalSeeds(spots, perTree, seed) {
  const n = spots.length * perTree, rand = random(seed);
  const out = { start: new Float32Array(n * 3), phase: new Float32Array(n), speed: new Float32Array(n), sway: new Float32Array(n), drop: new Float32Array(n), tint: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const spot = spots[Math.floor(i / perTree)], c = crownOf(spot), [dx, dy, dz] = inBall(rand, c.r * CHERRY_CROWN.startShare);
    out.start.set([c.x + dx, c.y + dy, c.z + dz], i * 3);
    out.phase[i] = rand();
    out.speed[i] = PETAL_FALL.speed * spread(rand, PETAL_FALL.speedSpread);
    out.sway[i] = PETAL_FALL.sway * spread(rand, PETAL_FALL.swaySpread);
    out.drop[i] = c.y + dy - spot[1];
    out.tint[i] = rand();
  }
  return out;
}

/**
 * Ground positions for the fallen petals: scattered in a disc of the crown radius times spread around the trunk,
 * pushed up to `downwind` units along the wind, at heightAt + lift + lift(x, z). Spots under `water` are dropped.
 * Returns pos (xyz), yaw, tilt, tint and the tree index of each petal.
 */
export function fallenSpots(spots, perTree, heightAt, seed, { water = -Infinity, lift = () => 0 } = {}) {
  const rand = random(seed), wx = Math.cos(PETAL_WIND_DIR), wz = Math.sin(PETAL_WIND_DIR);
  const pos = [], yaw = [], tilt = [], tint = [], tree = [];
  spots.forEach((spot, t) => {
    const r = crownOf(spot).r * PETAL_GROUND.spread;
    for (let k = 0; k < perTree; k++) {
      const a = rand() * TURN, d = Math.sqrt(rand()) * r, w = rand() * PETAL_GROUND.downwind;
      const x = spot[0] + Math.cos(a) * d + wx * w, z = spot[2] + Math.sin(a) * d + wz * w, ground = heightAt(x, z);
      const turn = rand() * TURN, lean = (rand() * 2 - 1) * PETAL_GROUND.tilt, shade = rand();
      if (ground < water) continue;
      pos.push(x, ground + PETAL_GROUND.lift + lift(x, z), z); yaw.push(turn); tilt.push(lean); tint.push(shade); tree.push(t);
    }
  });
  return { pos: new Float32Array(pos), yaw: new Float32Array(yaw), tilt: new Float32Array(tilt), tint: new Float32Array(tint), tree };
}
