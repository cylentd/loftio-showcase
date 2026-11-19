// Plans where the valley's trees stand: path gates, groves, lone specimens, then a pine backdrop. Pure: no three.js, no DOM.
import { WOODS_SEED, SHARE, TRIES, SPACING, GROUND, GATES, GROVES, BACKDROP, SPECIMEN, SPOT, GREEN_SHARE, CHERRY_SHORE } from './woodland-plan-data.mjs';

const TAU = Math.PI * 2;
const KINDS = ['canopy', 'cone', 'column', 'umbrella', 'cherry', 'pine'];
const GREEN = Object.keys(GREEN_SHARE);
const GRID_CELL = 6; // spatial hash cell, about the widest trunk gap
const WIDEST_GAP = Math.max(...Object.values(SPACING));

/** A repeatable 0..1 number from a position: the valley is the same on every load. */
export function positionHash(x, z) {
  const s = Math.sin(x * SPOT.hash.x + z * SPOT.hash.z) * SPOT.hash.amp;
  return s - Math.floor(s);
}

function mulberry32(seed) { // the same stream util.js rng gives; copied because util.js pulls in three.js
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0), 1);
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
const lineDist = (line, x, z) => Math.min(...line.slice(1).map((b, i) => segDist(x, z, line[i][0], line[i][1], b[0], b[1])));

/** Spatial hash of placed trees, so a spacing test touches a few cells, not every tree. */
function makeGrid() {
  const cells = new Map(), cellOf = (v) => Math.floor(v / GRID_CELL);
  return {
    add(tree) { const k = `${cellOf(tree.x)},${cellOf(tree.z)}`; (cells.get(k) ?? cells.set(k, []).get(k)).push(tree); },
    any(x, z, radius, test) {
      const span = Math.ceil(radius / GRID_CELL);
      for (let i = cellOf(x) - span; i <= cellOf(x) + span; i++) for (let j = cellOf(z) - span; j <= cellOf(z) + span; j++) {
        for (const t of cells.get(`${i},${j}`) ?? []) if (test(t, Math.hypot(t.x - x, t.z - z))) return true;
      }
      return false;
    },
  };
}

/** Is this ground one a tree may stand on, whatever the stage. */
function groundOk(inp, x, z) {
  const h = inp.heightAt(x, z);
  if (h < inp.water + GROUND.waterMargin || h > GROUND.maxHeight) return false;
  if (inp.sea !== undefined && h < inp.sea + GROUND.seaMargin) return false; // no tree in the cloud sea or on the cliff face above it
  if (inp.clear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)) return false;
  const m = inp.maskAt(x, z);
  if (m.sand > GROUND.maxSand || m.wet > GROUND.maxWet) return false;
  if (inp.paths.some((line) => lineDist(line, x, z) < GROUND.pathKeepOff)) return false;
  return !inp.sightlines.some(([ax, az, bx, bz, w]) => segDist(x, z, ax, az, bx, bz) < w);
}

/** The grove a point belongs to: the one it is deepest inside, by share of radius. */
function ownerOf(groves, x, z) {
  let best = null, bestRatio = Infinity;
  for (const g of groves) {
    const ratio = Math.hypot(x - g.x, z - g.z) / g.r;
    if (ratio <= 1 && ratio < bestRatio) { best = g; bestRatio = ratio; }
  }
  return best;
}

/** Size follows position: no sapling in a grove's core, nothing tall or giant on its fringe. */
function ringOk(s, x, z) {
  const g = ownerOf(s.groves, x, z);
  if (!g) return true;
  const ratio = Math.hypot(x - g.x, z - g.z) / g.r, size = s.inp.varietyAt(x, z).size;
  if (ratio < GROVES.innerRing && size === 'sapling') return false;
  return !(ratio > GROVES.outerRing && (size === 'tall' || size === 'giant'));
}

function fits(s, x, z, kind) {
  if (!groundOk(s.inp, x, z) || !ringOk(s, x, z)) return false;
  if (kind === 'cherry' && s.inp.varietyAt(x, z).size === 'giant') return false; // a giant's height stretch turns cherry puffs into upright eggs
  return !s.grid.any(x, z, WIDEST_GAP, (t, d) => d < Math.max(SPACING[kind], SPACING[t.kind]));
}

function place(s, x, z, kind) {
  s.out[kind].push([x, z]);
  s.grid.add({ x, z, kind });
}

/** A point uniform by area in the ring between two radii around the origin. */
function ringPoint(rnd, from, to) {
  const r = Math.sqrt(from * from + (to * to - from * from) * rnd()), a = rnd() * TAU;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

function groveKind(s, x, z) {
  const { inp, rnd } = s, [lx, lz, lr] = inp.lake;
  if (inp.heightAt(x, z) > GROVES.pineAbove) return 'pine';
  const shore = Math.abs(Math.hypot(x - lx, z - lz) - lr);
  if (shore < GROVES.waterSide) return 'cherry'; // the lake shore only: with the creek too, a quarter of the valley was pink
  let pick = rnd();
  return GREEN.find((k) => (pick -= GREEN_SHARE[k]) < 0) ?? GREEN[0]; // the fallback only covers float rounding at the top of the range
}

/** The second kind a grove mixes in: canopy for a cherry grove, else another green kind. */
function companionOf(rnd, kind) {
  if (kind === 'cherry') return 'canopy';
  const others = GREEN.filter((k) => k !== kind);
  return others[Math.floor(rnd() * others.length)];
}

/** Grove centres by dart throwing; stops after a run of failed throws. Returns groves with no trees yet. */
function chooseGroves(s, maxCentres) {
  const { rnd } = s, [rMin, rMax] = GROVES.radius, [lx, lz, lr] = s.inp.lake;
  for (const a of CHERRY_SHORE.angles) { // the lake's cherry groves come first, at chosen spots
    const d = lr * CHERRY_SHORE.ring;
    s.groves.push({ x: lx + Math.cos(a) * d, z: lz + Math.sin(a) * d, r: CHERRY_SHORE.radius, kind: 'cherry', companion: companionOf(rnd, 'cherry') });
  }
  for (let fails = 0; fails < TRIES.perCentre && s.groves.length < maxCentres;) {
    const played = rnd() < GROVES.playedShare;
    const [x, z] = played ? ringPoint(rnd, 0, GROVES.playedReach) : ringPoint(rnd, GROVES.playedReach, GROVES.reach);
    const apart = s.groves.every((g) => Math.hypot(x - g.x, z - g.z) >= GROVES.centreGap);
    if (!apart || !groundOk({ ...s.inp, paths: [] }, x, z)) { fails++; continue; }
    const kind = groveKind(s, x, z);
    s.groves.push({ x, z, r: rMin + (rMax - rMin) * rnd(), kind, companion: companionOf(rnd, kind) });
    fails = 0;
  }
}

/** Pairs of canopy trees facing each other across each path. Returns how many trees it placed. */
function placeGates(s, budget) {
  let placed = 0;
  for (const line of s.inp.paths) {
    let walked = 0, next = GATES.firstAt;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i], len = Math.hypot(bx - ax, bz - az);
      for (; next <= walked + len && placed + 2 <= budget; next += GATES.every) {
        const f = (next - walked) / len, px = ax + (bx - ax) * f, pz = az + (bz - az) * f;
        const nx = -(bz - az) / len * GATES.offset, nz = (bx - ax) / len * GATES.offset;
        if (!fits(s, px + nx, pz + nz, GATES.kind) || !fits(s, px - nx, pz - nz, GATES.kind)) continue;
        place(s, px + nx, pz + nz, GATES.kind);
        place(s, px - nx, pz - nz, GATES.kind);
        placed += 2;
      }
      walked += len;
    }
  }
  return placed;
}

/** Fills each grove, sharing the budget by area. Returns how many trees it placed. */
function fillGroves(s, budget) {
  const area = s.groves.reduce((sum, g) => sum + g.r * g.r, 0);
  let placed = 0;
  for (const g of s.groves) {
    const want = Math.round(budget * g.r * g.r / area);
    const companions = Math.floor(want * (1 - GROVES.kindShare)); // an exact quota, so a small grove cannot drift below its share by chance
    let got = 0, mixed = 0;
    for (let tries = TRIES.perTree * want; got < want && tries > 0; tries--) {
      const a = s.rnd() * TAU, d = g.r * Math.pow(s.rnd(), GROVES.coreExponent), x = g.x + Math.cos(a) * d, z = g.z + Math.sin(a) * d;
      const kind = mixed < companions && s.rnd() < 1 - GROVES.kindShare ? g.companion : g.kind;
      if (ownerOf(s.groves, x, z) !== g || !fits(s, x, z, kind)) continue;
      place(s, x, z, kind);
      got++;
      if (kind !== g.kind) mixed++;
    }
    placed += got;
  }
  return placed;
}

const higherThanRing = (h, x, z) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => h(x, z) > h(x + dx * SPECIMEN.probe, z + dz * SPECIMEN.probe));

/** Single canopy trees on high ground, clear of every other tree. Returns how many it placed. */
function placeSpecimens(s, budget) {
  let placed = 0;
  for (let tries = TRIES.perTree * budget; placed < budget && tries > 0; tries--) {
    const [x, z] = ringPoint(s.rnd, 0, SPECIMEN.reach);
    if (!higherThanRing(s.inp.heightAt, x, z) || !fits(s, x, z, SPECIMEN.kind)) continue;
    if (s.grid.any(x, z, SPECIMEN.apart, (t, d) => d < SPECIMEN.apart)) continue;
    place(s, x, z, SPECIMEN.kind);
    s.specimens.push([x, z]);
    placed++;
  }
  return placed;
}

/** Pines, a quarter of them cones, in a ring beyond the valley, where the density noise is high. */
function placeBackdrop(s, budget) {
  let placed = 0;
  for (let tries = TRIES.perTree * budget; placed < budget && tries > 0; tries--) {
    const [x, z] = ringPoint(s.rnd, BACKDROP.from, BACKDROP.to), kind = s.rnd() < BACKDROP.coneShare ? 'cone' : 'pine';
    if (s.inp.densityAt(x, z) < BACKDROP.minDensity || !fits(s, x, z, kind)) continue;
    place(s, x, z, kind);
    s.backdrop.push([x, z]);
    placed++;
  }
  return placed;
}

/**
 * @param {{count:number, hills?:number, heightAt:Function, maskAt:Function, varietyAt:Function, densityAt:Function, paths:number[][][], creek:number[][], lake:number[], water:number, sea?:number, clear:number[][], sightlines:number[][]}} inp
 * @returns {{canopy:number[][], cone:number[][], column:number[][], umbrella:number[][], cherry:number[][], pine:number[][], groves:object[], specimens:number[][], backdrop:number[][]}}
 */
export function planWoods(inp) {
  const s = { inp, rnd: mulberry32(WOODS_SEED), grid: makeGrid(), groves: [], specimens: [], backdrop: [], out: Object.fromEntries(KINDS.map((k) => [k, []])) };
  const share = (v) => Math.round(inp.count * v);
  chooseGroves(s, Math.floor(share(SHARE.groves) / GROVES.minTrees));
  const gates = placeGates(s, share(SHARE.gates));
  const grove = fillGroves(s, share(SHARE.groves) + share(SHARE.gates) - gates);
  const spec = placeSpecimens(s, share(SHARE.specimens) + share(SHARE.groves) + share(SHARE.gates) - gates - grove);
  placeBackdrop(s, inp.count - gates - grove - spec + (inp.hills ?? 0)); // hills: extra outer trees, placed last so the valley's own trees stay put
  return { ...s.out, groves: s.groves, specimens: s.specimens, backdrop: s.backdrop };
}
