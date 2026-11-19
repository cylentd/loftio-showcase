// Leaves on a puffy crown: small bent V shapes scattered over the outer surface of each puff, base just inside, pointing out
// and down like shingles, so the crown's outline breaks into a ragged leafy edge. Pure (no three.js). Numbers: CLAY_LEAVES.
import { CLAY_LEAVES as K } from './tree-clay-data.mjs';
import { seeded } from './tree-facets.mjs';
import { add, cross, dot, mul, norm, smooth } from './tree-clay-mesh.mjs';

const GOLDEN = Math.PI * (3 - Math.sqrt(5)), TWO_PI = Math.PI * 2;
const lerp = ([a, b], t) => a + (b - a) * t;

/** Normalised ellipsoid radius of p in clump c (1 on its surface, below 1 inside). */
function reach(c, p) {
  const dx = p[0] - c.c[0], dz = p[2] - c.c[2], cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0);
  return Math.hypot((dx * cs - dz * sn) / c.r[0], (p[1] - c.c[1]) / c.r[1], (dx * sn + dz * cs) / c.r[2]);
}

/** Point (BASE_IN inside the surface) and outward normal of clump c in unit direction d, in tree space. */
function surfaceAt(c, d) {
  const cs = Math.cos(c.yaw || 0), sn = Math.sin(c.yaw || 0), k = 1 - K.BASE_IN;
  const lx = d[0] * c.r[0] * k, lz = d[2] * c.r[2] * k, nx = d[0] / c.r[0], nz = d[2] / c.r[2];
  return { p: [c.c[0] + lx * cs + lz * sn, c.c[1] + d[1] * c.r[1] * k, c.c[2] - lx * sn + lz * cs], n: norm([nx * cs + nz * sn, d[1] / c.r[1], -nx * sn + nz * cs]) };
}

/** Even directions over the unit sphere (Fibonacci), turned by a seeded angle. */
function evenDirs(n, turn) {
  return Array.from({ length: n }, (_, i) => { const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * GOLDEN + turn; return [Math.cos(a) * r, y, Math.sin(a) * r]; });
}

/** Candidate spots on every puff, as many as its share of the crown's surface; spots inside another puff are dropped. */
function candidates(clumps, total, R) {
  const area = clumps.map((c) => c.r[0] * c.r[1] + c.r[0] * c.r[2] + c.r[1] * c.r[2]), sum = area.reduce((a, b) => a + b, 0);
  return clumps.flatMap((c, part) => evenDirs(Math.ceil((total * area[part]) / sum), R() * TWO_PI)
    .map((d) => ({ part, ...surfaceAt(c, d) }))
    .filter((s) => clumps.every((o, j) => j === part || reach(o, s.p) >= 1)));
}

/** Leaf direction: out from the surface, tilted down by `tilt` and turned sideways by `side` around the normal. */
function leafDir(n, tilt, side, spin) {
  let t = add([0, -1, 0], mul(n, n[1]));
  if (Math.hypot(...t) < 1e-3) t = [Math.cos(spin), 0, Math.sin(spin)]; // at a pole any tangent will do
  t = norm(t);
  const turned = add(mul(t, Math.cos(side)), mul(cross(n, t), Math.sin(side)));
  return norm(add(mul(n, Math.cos(tilt)), mul(turned, Math.sin(tilt))));
}

/**
 * `count` leaves over the clumps ({c, r, yaw}), seeded. Spots are picked by weighted sampling without replacement
 * (key = u^(1/w)), weight UNDER on undersides rising to 1 on tops. Each leaf: {part, base, normal, dir, len, shade}.
 */
export function scatterLeaves(clumps, count, seed) {
  if (!count) return [];
  const R = seeded(seed), pool = candidates(clumps, count * K.POOL, R);
  const keyed = pool.map((s) => ({ s, key: Math.pow(R(), 1 / (K.UNDER + (1 - K.UNDER) * smooth(-1, 1, s.n[1]))) }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, count).map(({ s }) => {
    const dir = leafDir(s.n, lerp(K.TILT, R()), (R() - 0.5) * 2 * K.SIDE, R() * TWO_PI);
    const shade = (R() - 0.5) * 2 * K.TONE_JITTER - (R() < K.DARK_SHARE ? K.DARK : 0);
    return { part: s.part, base: s.p, normal: s.n, dir, len: lerp(K.LEN, R()), shade };
  });
}

/** One leaf as 6 vertices and 4 triangles: base, two pairs of sides lifted off the midrib (a cupped, rounded blade), tip.
 * Every vertex shares one normal that leans to the puff's, so leaves light with the crown. */
export function leafMesh(l) {
  const side = norm(cross(l.dir, l.normal)), up = cross(side, l.dir), ln = dot(up, l.normal) < 0 ? mul(up, -1) : up;
  const half = (l.len * K.WIDTH) / 2, lift = mul(ln, l.len * K.FOLD);
  const pair = ([u, w]) => { const c = add(add(l.base, mul(l.dir, l.len * u)), lift); return [add(c, mul(side, half * w)), add(c, mul(side, -half * w))]; };
  const verts = [l.base, ...pair(K.ROWS[0]), ...pair(K.ROWS[1]), add(l.base, mul(l.dir, l.len))];
  const n = norm(add(mul(l.normal, K.NORMAL_PUFF), mul(ln, 1 - K.NORMAL_PUFF)));
  return { verts, faces: [[0, 1, 2], [1, 3, 2], [2, 3, 4], [3, 5, 4]], normals: verts.map(() => n) };
}

/**
 * Appends leaves to a crown build (newOut shape plus `leafBase`): puff vertices already in it get a zero base.
 * tone(leaf) and light(p, n, part) colour each leaf; heights lift the tone toward the crown top (lo..hi in y).
 */
export function appendLeaves(out, leaves, tone, light, lo, hi) {
  out.leafBase = new Array(out.positions.length).fill(0);
  for (const l of leaves) {
    const m = leafMesh(l), base = out.positions.length / 3, t = tone(l) + K.TOP_TONE * smooth(lo, hi, l.base[1]);
    m.verts.forEach((p) => { out.positions.push(...p); out.normals.push(...m.normals[0]); out.tone.push(t); out.part.push(l.part); out.light.push(light(p, l.normal, l.part)); out.leafBase.push(...l.base); });
    for (const f of m.faces) out.index.push(base + f[0], base + f[1], base + f[2]);
  }
  return out;
}
