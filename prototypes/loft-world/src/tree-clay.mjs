// Clay trees from a seed: smooth overlapping pillows (leafy kinds) or tiers of drooping petals (pine), on smooth wood with a
// flared foot. Pure (no three.js): the same recipes and layouts as tree-facets, new surfaces, plus a baked light term.
import { RECIPES, FACETS as F } from './tree-facets-data.mjs';
import { LAYOUTS, branchPath, countIn, pickAnchors, pointAtY, seeded, topIndex, trunkPath } from './tree-facets.mjs';
import { CLAY_CLUMP as C, CLAY_LIGHT as L, CLAY_LOD, CLAY_PINE as P, CLAY_RECIPES, CLAY_WOOD as W, LOD_HIGH } from './tree-clay-data.mjs';
import { add, clamp01, clayClump, clayPetal, clayTube, freeze, mul, newOut, packMesh, smooth } from './tree-clay-mesh.mjs';
import { CLAY_LEAVES as LV } from './tree-clay-data.mjs';
import { appendLeaves, scatterLeaves } from './tree-leaves.mjs';

const TWO_PI = Math.PI * 2;
/** Multiplies the tree seed for the leaf stream: a prime, so it never matches a puff's stream (seed * 31 + i). */
const LEAF_SEED_SALT = 7919;

/** Baked light 0..1 of a surface point p with normal n: 1 exposed, lower inside or tucked under the clumps (skip = its own). */
export function lightAt(p, n, clumps, skip) {
  let occ = 0;
  clumps.forEach((c, j) => {
    if (j === skip) return;
    const dx = p[0] - c.c[0], dz = p[2] - c.c[2], cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0);
    const s = Math.hypot((dx * cs - dz * sn) / c.r[0], (p[1] - c.c[1]) / c.r[1], (dx * sn + dz * cs) / c.r[2]);
    const above = L.ABOVE_WEIGHT + (1 - L.ABOVE_WEIGHT) * clamp01(((c.c[1] - p[1]) / c.r[1]) * 0.5 + 0.5);
    occ += clamp01((1 + L.REACH - s) / L.REACH) * above;
  });
  return Math.max((1 - L.TUCK * Math.min(occ, 1)) * (1 - L.UNDER * Math.max(-n[1], 0)), L.MIN);
}

/** Path with extra rings in the foot so the flare and its toes stay round; starts a little under the ground. */
function densify(path, footH, rings) {
  const out = Array.from({ length: rings }, (_, k) => pointAtY(path, -footH * 0.1 + (footH * k) / rings));
  return [...out, ...path.filter((p) => p[1] > footH)];
}

/** Trunk mesh: tapered, flared at the foot, with `toes` soft root lobes. Ring radius depends on height and angle. */
function trunkMesh(R, path0, base, taper, H, sides) {
  const footH = H * W.FOOT_HEIGHT, path = densify(path0, footH, W.FOOT_RINGS), toes = countIn(R, W.TOES), ph = R() * TWO_PI, top = path[path.length - 1][1];
  const radiusAt = (i, a) => {
    const y = Math.max(path[i][1], 0), f = y / (top || 1), fall = Math.exp(-y / (footH * W.TOE_SPREAD * 0.5)), lobe = Math.pow(0.5 + 0.5 * Math.cos(toes * (a - ph)), 2);
    return base * (1 - (1 - taper) * f) * (1 + W.FOOT * fall + W.TOE_AMP * lobe * fall);
  };
  return clayTube(path, radiusAt, sides);
}

/** Bounding sphere (box centre, farthest vertex), collider numbers and triangle count of a finished tree. */
function finish(crown, wood, clumps, tips, trunkInfo, closedMeshes, H) {
  const p = crown.positions, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[i + a]); hi[a] = Math.max(hi[a], p[i + a]); }
  const center = mul(add(lo, hi), 0.5);
  let radius = 0;
  for (let i = 0; i < p.length; i += 3) radius = Math.max(radius, Math.hypot(p[i] - center[0], p[i + 1] - center[1], p[i + 2] - center[2]));
  const colliderTop = Math.min(trunkInfo.endY, lo[1] + F.COLLIDER_CROWN_SHARE * (hi[1] - lo[1]));
  return { crown, wood, clumps, tips, closedMeshes, height: H, envelope: { center, radius }, trunk: { radius: trunkInfo.radius * F.COLLIDER_RADIUS_SHARE, top: colliderTop }, bounds: { lo, hi }, triangles: (crown.index.length + wood.index.length) / 3 };
}

/** Branches from the trunk to clumps: tubes with a flared start, so each leaves the trunk in a smooth join. */
function addBranches(R, o) {
  const { clumps, p, forks, spine, path, rads, endY, H, sides, wood, tips } = o, arms = [];
  const flagged = clumps.flatMap((c, i) => (c.anchor ? [i] : [])), anchors = flagged.length ? flagged : pickAnchors(clumps, p.layout === 'bonsai' ? clumps.length : forks, spine);
  const grow = (from, r0, ci, k) => {
    const pts = branchPath(R, from, clumps[ci], k), radiusAt = (i) => { const f = i / (pts.length - 1); return r0 * (1 - (1 - F.BRANCH_TAPER) * f) * (1 + W.BRANCH_FLARE * clamp01(1 - f / W.BRANCH_FLARE_LEN)); };
    const br = clayTube(pts, radiusAt, sides);
    packMesh(wood, br, 1 + k, () => 0.5, (i) => lightAt(br.verts[i], br.normals[i], clumps, -1));
    tips.push(pts[pts.length - 1]);
    return pts;
  };
  anchors.forEach((ci, k) => {
    const from = spine ? pointAtY(path, Math.min(Math.max(clumps[ci].c[1] * 0.85, F.SPINE_BRANCH_MIN * H), endY * 0.92)) : path[path.length - 1];
    const r0 = rads[spine ? Math.round((from[1] / endY) * (path.length - 1)) : path.length - 1] * F.BRANCH_START_RADIUS;
    arms.push({ pts: grow(from, r0, ci, k), r0 });
  });
  if (!p.twig) return;
  clumps.forEach((c, ci) => { // a twig from part way along its arm to each bunched puff, so no puff floats
    if (c.arm === undefined || (ci - anchors.length) % (p.twig.every || 1)) return;
    const arm = arms[c.arm];
    grow(arm.pts[Math.round(p.twig.from * (arm.pts.length - 1))], arm.r0 * p.twig.radius, ci, anchors.length + ci);
  });
}

/** Leaves on the crown build: scattered over the puffs, toned from their puff, lit like it. Returns the leaf count. */
function addLeaves(crown, clumps, tones, count, seed) {
  const leaves = scatterLeaves(clumps, count, seed * LEAF_SEED_SALT);
  const lo = Math.min(...clumps.map((c) => c.c[1] - c.r[1])), hi = Math.max(...clumps.map((c) => c.c[1] + c.r[1]));
  appendLeaves(crown, leaves, (l) => tones[l.part] + l.shade, (p, n, part) => lightAt(p, n, clumps, part), lo, hi);
  return leaves.length;
}

function buildLeafy(o, recipe, lod) {
  const R = seeded(o.seed), H = o.height, forks = countIn(R, recipe.forks), crown = newOut(), wood = newOut(), tips = [], closedMeshes = [];
  const leafCount = recipe.leaves && o.leaves !== false ? lod.leaves : 0, shrink = leafCount ? LV.PUFF_SHRINK : 1;
  const clumps = LAYOUTS[recipe.layout]({ R, H, L: o.leaf, p: recipe, forks }).map((c) => { const k = (1 + (R() - 0.5) * 2 * C.SIZE_VARIETY) * shrink; return { ...c, r: c.r.map((x) => x * k) }; });
  const puffTris = lod.crownTris * (recipe.crownShare?.[o.lod || LOD_HIGH] || 1) - leafCount * LV.TRIS * lod.leafTrade;
  const tris = recipe.puffTris?.[o.lod || LOD_HIGH] ?? Math.min(Math.max(puffTris / clumps.length, lod.clumpMin), lod.clumpMax), tones = [];
  clumps.forEach((spec, i) => {
    const m = clayClump(seeded(o.seed * 31 + i), recipe.lumps ? { ...spec, lumps: recipe.lumps } : spec, tris), tone = 0.5 + (R() - 0.5) * 2 * C.TONE_SPREAD;
    closedMeshes.push(m);
    tones.push(tone);
    packMesh(crown, m, i, (v) => tone + 0.15 * m.normals[v][1], (v) => lightAt(m.verts[v], m.normals[v], clumps, i));
  });
  const leaves = leafCount ? addLeaves(crown, clumps, tones, leafCount, o.seed) : 0;
  const spine = recipe.trunk.spine, base = o.girth * F.TRUNK_FLARE, endY = spine ? clumps[topIndex(clumps)].c[1] : H * recipe.trunk.top, path = trunkPath(R, H, recipe.trunk, endY);
  if (spine) path[path.length - 1] = [path[path.length - 1][0] * 0.3, endY, path[path.length - 1][2] * 0.3];
  const taper = spine ? F.SPINE_TIP_RADIUS : F.TRUNK_TAPER, rads = path.map((_, i) => base * (1 - (1 - taper) * (i / (path.length - 1))));
  const trunk = trunkMesh(R, path, base, taper, H, lod.sides), tips2 = spine ? [path[path.length - 1]] : [];
  packMesh(wood, trunk, 0, () => 0.5, (i) => lightAt(trunk.verts[i], trunk.normals[i], clumps, -1));
  tips.push(...tips2);
  addBranches(R, { clumps, p: recipe, forks, spine, path, rads, endY, H, sides: lod.sides, wood, tips });
  return { ...finish(freeze(crown), freeze(wood), clumps, tips, { radius: base, endY }, closedMeshes, H), leaves };
}

/** Tier t's tip radius and tip height (t = 0 is the lowest). */
const tierShape = (t, tiers, H) => { const f = t / (tiers - 1); return { R: H * P.RADIUS * (1 - f * (1 - P.TOP_RADIUS)), y: H * (P.BASE_Y + f * (P.TOP_Y - P.BASE_Y)) }; };

/** Light of a petal vertex: dark at its root and where the tier above covers it, lighter on the tongue, a little darker underneath. */
function petalLight(p, n, pm, above) {
  const root = P.ROOT_LIGHT + (1 - P.ROOT_LIGHT) * smooth(0.1, 0.75, pm.u), tuck = above ? P.UPPER_TUCK * smooth(above.R * 1.1, above.R * 0.5, Math.hypot(p[0], p[2])) : 0;
  return Math.max(root * (1 - tuck) * (1 - L.UNDER * Math.max(-n[1], 0)), L.MIN);
}

function pineTiers(R, o, lod, crown) {
  const H = o.height, step = ((P.TOP_Y - P.BASE_Y) * H) / (lod.tiers - 1), petals = [];
  for (let t = 0; t < lod.tiers; t++) {
    const s = tierShape(t, lod.tiers, H), above = t + 1 < lod.tiers ? tierShape(t + 1, lod.tiers, H) : null, n = lod.petalsPerTier[t], turn = R() * TWO_PI, tone = 0.4 + (t / (lod.tiers - 1)) * P.TONE_STEP * lod.tiers;
    for (let i = 0; i < n; i++) {
      const a = turn + ((i + (R() - 0.5) * 2 * P.ANGLE_JITTER) / n) * TWO_PI, len = 1 + (R() - 0.5) * 2 * P.LENGTH_JITTER, rho1 = s.R * len;
      const spec = { a, rho0: s.R * P.ROOT_R, rho1, y0: s.y + step * P.TIER_REACH, y1: s.y, drop: step * P.DROP, half: ((TWO_PI * s.R) / n) * P.OVERLAP };
      const m = clayPetal(spec, lod.petalU, lod.petalV), pt = tone + (R() - 0.5) * 0.08;
      petals.push({ spec, a, tier: t, rho: rho1 });
      packMesh(crown, m, t, () => pt, (v) => petalLight(m.verts[v], m.normals[v], m.params[v], above));
    }
  }
  return petals;
}

function buildPine(o, lod) {
  const R = seeded(o.seed), H = o.height, crown = newOut(), wood = newOut(), petals = pineTiers(R, o, lod, crown);
  const capSpec = { c: [0, H * P.CAP_Y, 0], r: [H * P.CAP_R, H * P.CAP_H, H * P.CAP_R], yaw: 0 }, cap = clayClump(seeded(o.seed + 5), capSpec, lod.clumpMax * 0.3);
  const top = tierShape(lod.tiers - 1, lod.tiers, H), low = tierShape(0, lod.tiers, H);
  packMesh(crown, cap, lod.tiers, () => 0.62, (v) => 0.55 + 0.45 * smooth(-0.3, 0.6, cap.normals[v][1]));
  const coreAt = (i) => P.CORE_R * (low.R + ((top.R - low.R) * (i / 5)));
  const core = clayTube(Array.from({ length: 6 }, (_, i) => [0, H * (0.2 + (0.72 * i) / 5), 0]), coreAt, lod.coreSides);
  packMesh(crown, core, 0, () => 0.3, () => P.ROOT_LIGHT);
  const path = [[0, 0, 0], [0, H * P.TRUNK_TOP * 0.5, 0], [0, H * P.TRUNK_TOP, 0]], trunk = trunkMesh(R, path, H * P.TRUNK_R, 0.8, H, lod.sides);
  packMesh(wood, trunk, 0, () => 0.5, (i) => (trunk.verts[i][1] > low.y ? 0.6 : 1));
  const spec = petals.map((p) => ({ c: [0, p.spec.y1, 0], r: [p.rho, 1, p.rho] }));
  const t = finish(freeze(crown), freeze(wood), spec, [], { radius: H * P.TRUNK_R * (1 + W.FOOT), endY: H * P.TRUNK_TOP }, [], H);
  return { ...t, petals: petals.length };
}

/** @param {{archetype:string, seed:number, height:number, leaf:number, girth:number, lod?:'high'|'phone'}} o */
export function buildClayTree(o) {
  const shared = RECIPES[o.archetype], own = CLAY_RECIPES[o.archetype], lod = CLAY_LOD[o.lod || LOD_HIGH];
  const recipe = (shared || own?.layout) && { ...shared, ...own }; // cherry and umbrella exist only as clay recipes
  if (!recipe) throw new Error(`unknown archetype ${o.archetype}`);
  return recipe.layout === 'pine' ? buildPine(o, lod) : buildLeafy(o, recipe, lod);
}
