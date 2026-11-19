// Faceted low-poly trees from a seed. Pure (no three.js, no browser): a tree is arrays the view turns into geometry.
// A clump is an icosphere with jittered vertices, emitted flat-shaded; the trunk and its forks are 6-sided tubes whose
// tips end inside clumps. Recipes and numbers live in tree-facets-data.mjs.
import { FACETS as F, PINE, RECIPES } from './tree-facets-data.mjs';

/** Layout jitters not worth a recipe field: azimuth wobble (turns), ring height wobble (share of H), top clump offset (share of L). */
const AZ_WOBBLE = 0.35, Y_WOBBLE = 0.06, TOP_OFFSET = 0.3, CLUMP_SIZE_WOBBLE = 0.3, PHI = (1 + Math.sqrt(5)) / 2;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const lerp3 = (a, b, t) => add(mul(a, 1 - t), mul(b, t));

/** Deterministic random numbers in [0, 1) from an integer seed. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Unit icosphere, indexed: { verts, faces }. detail 1 = 80 faces, 2 = 320. */
export function icosphere(detail) {
  let verts = [[-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]].map(norm);
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const mid = new Map(), next = [];
    const at = (a, b) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      if (!mid.has(key)) { mid.set(key, verts.length); verts = [...verts, norm(lerp3(verts[a], verts[b], 0.5))]; }
      return mid.get(key);
    };
    for (const [a, b, c] of faces) { const ab = at(a, b), bc = at(b, c), ca = at(c, a); next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    faces = next;
  }
  return { verts, faces };
}

/** One clump: an icosphere stretched to spec.r, turned by spec.yaw, moved to spec.c, each vertex pushed in or out a little. */
export function facetClump(seed, spec, detail, jitter) {
  const R = seeded(seed), { verts: unit, faces } = icosphere(detail), cs = Math.cos(spec.yaw || 0), sn = Math.sin(spec.yaw || 0);
  const verts = unit.map(([x, y, z]) => {
    const k = 1 + (R() - 0.5) * 2 * jitter, lx = x * k * spec.r[0], lz = z * k * spec.r[2];
    return [spec.c[0] + lx * cs + lz * sn, spec.c[1] + y * k * spec.r[1], spec.c[2] - lx * sn + lz * cs];
  });
  return { verts, faces, spec };
}

/** Edges used by a face list: true when every edge is shared by exactly two faces (a closed surface). */
export function isClosed(faces) {
  const count = new Map();
  for (const [a, b, c] of faces) for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = p < q ? `${p},${q}` : `${q},${p}`; count.set(k, (count.get(k) || 0) + 1); }
  return [...count.values()].every((n) => n === 2);
}

/** Appends an indexed mesh to flat arrays: one normal per face, one tone per face. `inside` is a point inside the piece, used to face normals outward. */
function emit(out, mesh, part, R, spread, up, inside) {
  const base = 0.5 + (R() - 0.5) * 0.2; // each clump leans a little lighter or darker than its neighbours
  for (const f of mesh.faces) {
    const [a, b, c] = f.map((i) => mesh.verts[i]);
    let n = norm(cross(sub(b, a), sub(c, a)));
    const flip = dot(n, sub(mul(add(add(a, b), c), 1 / 3), inside(f))) < 0;
    if (flip) n = mul(n, -1);
    const tone = base + (R() - 0.5) * spread + up * n[1];
    for (const p of flip ? [a, c, b] : [a, b, c]) { out.positions.push(...p); out.normals.push(...n); out.tone.push(tone); out.part.push(part); }
  }
}

const newMesh = () => ({ positions: [], normals: [], tone: [], part: [] });
const done = (m) => ({ positions: Float32Array.from(m.positions), normals: Float32Array.from(m.normals), tone: Float32Array.from(m.tone), part: Float32Array.from(m.part) });

/** Tapered tube along points, indexed: rings of `sides` vertices. Faces are wound outward. */
export function tubeMesh(points, radii, sides = F.SIDES) {
  const verts = [], faces = [];
  points.forEach((p, i) => {
    const t = norm(sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]));
    let u = cross(t, [0, 0, 1]); if (len(u) < 0.01) u = [1, 0, 0];
    u = norm(u); const v = cross(t, u);
    for (let j = 0; j < sides; j++) { const a = (j / sides) * Math.PI * 2; verts.push(add(p, add(mul(u, Math.cos(a) * radii[i]), mul(v, Math.sin(a) * radii[i])))); }
  });
  for (let i = 0; i < points.length - 1; i++) for (let j = 0; j < sides; j++) {
    const A = i * sides + j, B = i * sides + (j + 1) % sides, C = A + sides, D = B + sides;
    faces.push([A, B, C], [B, D, C]);
  }
  return { verts, faces, points };
}

export const pointAtY = (path, y) => {
  for (let i = 0; i < path.length - 1; i++) if (y <= path[i + 1][1]) return lerp3(path[i], path[i + 1], Math.min(Math.max((y - path[i][1]) / (path[i + 1][1] - path[i][1] || 1), 0), 1));
  return path[path.length - 1];
};
const between = (R, [lo, hi]) => lo + R() * (hi - lo);
export const countIn = (R, [lo, hi]) => lo + Math.floor(R() * (hi - lo + 1));

export const LAYOUTS = {
  ball: ({ H, L, p }) => [{ c: [0, H - L * p.ry * 0.95, 0], r: [L * p.rx, L * p.ry, L * p.rx], yaw: 0 }],
  canopy({ R, H, L, p }) {
    const n = countIn(R, p.count) - 1, out = [];
    for (let i = 0; i < n; i++) {
      const a = ((i + (R() - 0.5) * AZ_WOBBLE) / n) * Math.PI * 2, rho = L * p.ring * (1 - CLUMP_SIZE_WOBBLE / 2 + R() * CLUMP_SIZE_WOBBLE), r = L * p.r * (1 - CLUMP_SIZE_WOBBLE / 2 + R() * CLUMP_SIZE_WOBBLE);
      const odd = i % 2 ? 1 : 0, lift = odd * (p.stagger || 0), pull = 1 - odd * (p.inset || 0); // optional: every other puff higher and further in, a lumpier outline
      out.push({ c: [Math.cos(a) * rho * pull, H * (p.ringY + lift + (R() - 0.5) * 2 * Y_WOBBLE), Math.sin(a) * rho * pull], r: [r, r * p.squash, r], yaw: R() * 6 });
    }
    out.push({ c: [(R() - 0.5) * L * TOP_OFFSET, H * p.topY, (R() - 0.5) * L * TOP_OFFSET], r: [L * p.topR, L * p.topR * p.squash, L * p.topR], yaw: R() * 6 });
    return out;
  },
  cone({ R, H, L, p }) {
    const out = [], rows = p.rows, top = H - L * p.r * p.squash * (1 - p.shrink * (rows.length - 1));
    rows.forEach((count, row) => {
      const r = L * p.r * (1 - p.shrink * row), y = H * p.baseY + (row / (rows.length - 1)) * (top - H * p.baseY), rho = count > 1 ? r * Math.min(1, (count - 1) * p.ringStep) : 0, turn = R() * 6;
      for (let i = 0; i < count; i++) { const a = turn + (i / count) * Math.PI * 2; out.push({ c: [Math.cos(a) * rho, y, Math.sin(a) * rho], r: [r, r * p.squash, r], yaw: R() * 6 }); }
    });
    return out;
  },
  column({ R, H, L, p }) {
    const n = countIn(R, p.count), out = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), bulge = 0.75 + 0.25 * Math.sin(f * Math.PI), rx = L * p.rx * bulge;
      out.push({ c: [(R() - 0.5) * 2 * rx * p.wobble, H * (p.baseY + f * (1 - p.baseY)) - L * p.ry * f * 0.8, (R() - 0.5) * 2 * rx * p.wobble], r: [rx, L * p.ry * bulge, rx], yaw: R() * 6 });
    }
    return out;
  },
  bonsai({ R, H, L, p, forks }) {
    const out = [], turn = R() * 6;
    for (let i = 0; i < forks; i++) {
      const a = turn + ((i + (R() - 0.5) * AZ_WOBBLE) / forks) * Math.PI * 2, rho = L * between(R, p.reach), rx = L * p.rx * (1 - CLUMP_SIZE_WOBBLE / 2 + R() * CLUMP_SIZE_WOBBLE);
      out.push({ c: [Math.cos(a) * rho, H * between(R, p.y), Math.sin(a) * rho], r: [rx, rx * p.squash, rx], yaw: R() * 6 });
    }
    return out;
  },
  /** Cherry: one puff at the end of each long low branch (an anchor), then smaller puffs bunched around those ends (each
   * names its `arm`), so the crown is wide, flat and broken into clusters with dark branches between them. */
  cherry({ R, H, L, p, forks }) {
    const out = [], turn = R() * Math.PI * 2, total = countIn(R, p.count), size = () => 1 - CLUMP_SIZE_WOBBLE / 2 + R() * CLUMP_SIZE_WOBBLE;
    for (let i = 0; i < forks; i++) {
      const a = turn + ((i + (R() - 0.5) * AZ_WOBBLE) / forks) * Math.PI * 2, rho = L * between(R, p.reach), r = L * p.r * size();
      out.push({ c: [Math.cos(a) * rho, H * between(R, p.y), Math.sin(a) * rho], r: [r, r * p.squash, r], yaw: R() * 6, anchor: true, a, rho });
    }
    for (let j = 0; out.length < total; j++) {
      const arm = out[j % forks], a = arm.a + (R() - 0.5) * 2 * p.spread, rho = arm.rho * between(R, p.inner), r = L * p.r * p.satellite * size();
      out.push({ c: [Math.cos(a) * rho, arm.c[1] + L * between(R, p.lift), Math.sin(a) * rho], r: [r, r * p.squash, r], yaw: R() * 6, arm: j % forks });
    }
    return out;
  },
  /** Umbrella (stone pine): a few wide flat pads around the top of a tall bare trunk, each on a branch, and one over the middle. */
  umbrella({ R, H, L, p, forks }) {
    const out = [], turn = R() * Math.PI * 2;
    for (let i = 0; i < forks; i++) {
      const a = turn + ((i + (R() - 0.5) * AZ_WOBBLE) / forks) * Math.PI * 2, rho = L * between(R, p.reach), rx = L * p.rx * (1 - CLUMP_SIZE_WOBBLE / 2 + R() * CLUMP_SIZE_WOBBLE);
      out.push({ c: [Math.cos(a) * rho, H * between(R, p.y), Math.sin(a) * rho], r: [rx, rx * p.squash, rx], yaw: R() * 6, anchor: true });
    }
    const rc = L * p.topR;
    out.push({ c: [0, H * p.topY, 0], r: [rc, rc * p.squash, rc], yaw: R() * 6 });
    return out;
  },
};

/** Which clumps a branch ends in: evenly around the tree by azimuth (forked trunk) or up its height (spine trunk). */
export function pickAnchors(clumps, n, spine) {
  const key = (c) => (spine ? c.c[1] : Math.atan2(c.c[2], c.c[0]));
  const order = clumps.map((_, i) => i).sort((a, b) => key(clumps[a]) - key(clumps[b])).filter((i) => !spine || i !== topIndex(clumps));
  return Array.from({ length: n }, (_, k) => order[Math.floor(((k + 0.5) * order.length) / n)]);
}
export const topIndex = (clumps) => clumps.reduce((best, c, i) => (c.c[1] > clumps[best].c[1] ? i : best), 0);

/** The bent trunk path from the ground to height `endY`. */
export function trunkPath(R, H, p, endY) {
  const phase = R() * 6, pts = [];
  for (let i = 0; i <= F.BRANCH_SEGMENTS + 1; i++) {
    const f = i / (F.BRANCH_SEGMENTS + 1), lean = p.bend * H * Math.sin(f * Math.PI * 0.9) * f;
    pts.push([Math.cos(phase) * lean, f * endY, Math.sin(phase) * lean]);
  }
  return pts;
}

/** A branch from `from` to a point inside `clump`: a gently bowed path of BRANCH_SEGMENTS pieces. */
export function branchPath(R, from, clump, k) {
  const inward = norm(sub(from, clump.c)), swirl = (k + 1) * 2.1, depth = F.TIP_DEPTH * Math.min(...clump.r);
  const tip = add(clump.c, mul(norm(add(inward, [Math.cos(swirl) * 0.3, 0, Math.sin(swirl) * 0.3])), depth));
  const span = sub(tip, from), side = norm(cross(span, [0, 1, 0])), pts = [];
  for (let i = 0; i <= F.BRANCH_SEGMENTS; i++) {
    const f = i / F.BRANCH_SEGMENTS, bow = Math.sin(f * Math.PI) * len(span);
    pts.push(add(add(lerp3(from, tip, f), mul(side, bow * F.BRANCH_WOBBLE * (R() - 0.5) * 2)), [0, bow * F.BRANCH_BOW, 0]));
  }
  pts[pts.length - 1] = tip;
  return pts;
}

function buildPine(seed, H) {
  const R = seeded(seed), crown = newMesh(), wood = newMesh(), P = PINE, step = ((P.TOP_Y - P.BASE_Y) * H) / (P.TIERS - 1), spec = [];
  for (let t = 0; t < P.TIERS; t++) {
    const f = t / (P.TIERS - 1), y = H * P.BASE_Y + t * step, R0 = H * P.RADIUS * (1 - f * (1 - P.TOP_RADIUS)), turn = R() * 6;
    const verts = [[0, y + step * P.RISE, 0], [0, y - step * P.DIP, 0]], faces = [], n = P.SPIKES * 2;
    for (let i = 0; i < n; i++) {
      const a = turn + (i / n) * Math.PI * 2, r = R0 * (i % 2 ? P.SPIKE_SHORT : 1) * (1 + (R() - 0.5) * 2 * P.JITTER);
      verts.push([Math.cos(a) * r, y - step * P.DROOP * (i % 2 ? 0.5 : 1), Math.sin(a) * r]);
    }
    for (let i = 0; i < n; i++) { const a = 2 + i, b = 2 + ((i + 1) % n); faces.push([0, b, a], [1, a, b]); }
    emit(crown, { verts, faces }, t, R, F.TONE_SPREAD, F.TONE_UP, () => [0, y, 0]);
    spec.push({ c: [0, y, 0], r: [R0, step, R0] });
  }
  const trunk = tubeMesh([[0, 0, 0], [0, H * P.TRUNK_TOP * 0.5, 0], [0, H * P.TRUNK_TOP, 0]], [H * P.TRUNK_RADIUS * 1.6, H * P.TRUNK_RADIUS, H * P.TRUNK_RADIUS * 0.4]);
  emit(wood, trunk, 0, R, F.WOOD_TONE_SPREAD, 0, (f) => [0, trunk.verts[f[0]][1], 0]);
  return finish(crown, wood, spec, [], { radius: H * P.TRUNK_RADIUS * 1.6, endY: H * P.TRUNK_TOP }, [], H);
}

/** Bounding sphere (box centre, farthest vertex), crown top and bottom, collider numbers, triangle count. */
function finish(crownMesh, woodMesh, clumps, tips, trunkInfo, closedMeshes, H) {
  const crown = done(crownMesh), wood = done(woodMesh), p = crown.positions, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[i + a]); hi[a] = Math.max(hi[a], p[i + a]); }
  const center = mul(add(lo, hi), 0.5);
  let radius = 0;
  for (let i = 0; i < p.length; i += 3) radius = Math.max(radius, len(sub([p[i], p[i + 1], p[i + 2]], center)));
  const colliderTop = Math.min(trunkInfo.endY, lo[1] + F.COLLIDER_CROWN_SHARE * (hi[1] - lo[1]));
  return { crown, wood, clumps, tips, closedMeshes, height: H, envelope: { center, radius }, trunk: { radius: trunkInfo.radius * F.COLLIDER_RADIUS_SHARE, top: colliderTop }, bounds: { lo, hi }, triangles: (crown.positions.length + wood.positions.length) / 9 };
}

/** @param {{archetype:string, seed:number, height:number, leaf:number, girth:number}} o */
export function buildFacetTree(o) {
  const recipe = RECIPES[o.archetype];
  if (!recipe) throw new Error(`unknown archetype ${o.archetype}`);
  if (recipe.layout === 'pine') return buildPine(o.seed, o.height);
  const R = seeded(o.seed), H = o.height, L = o.leaf, p = recipe, forks = countIn(R, p.forks);
  const clumps = LAYOUTS[p.layout]({ R, H, L, p, forks }), crown = newMesh(), wood = newMesh(), tips = [], closedMeshes = [];
  clumps.forEach((spec, i) => {
    const m = facetClump(o.seed * 31 + i, spec, p.detail, p.jitter);
    closedMeshes.push(m);
    emit(crown, m, i, R, F.TONE_SPREAD, F.TONE_UP, () => spec.c);
  });
  const spine = p.trunk.spine, base = o.girth * F.TRUNK_FLARE, topC = clumps[topIndex(clumps)];
  const endY = spine ? topC.c[1] : H * p.trunk.top, path = trunkPath(R, H, p.trunk, endY);
  if (spine) path[path.length - 1] = [path[path.length - 1][0] * 0.3, endY, path[path.length - 1][2] * 0.3]; // the spine finishes inside the top clump
  const rads = path.map((_, i) => base * (1 - (1 - (spine ? F.SPINE_TIP_RADIUS : F.TRUNK_TAPER)) * (i / (path.length - 1))));
  const trunk = tubeMesh(path, rads), end = path[path.length - 1];
  emit(wood, trunk, 0, R, F.WOOD_TONE_SPREAD, 0, (f) => path[Math.floor(f[0] / F.SIDES)]);
  if (spine) tips.push(end);
  pickAnchors(clumps, p.layout === 'bonsai' ? clumps.length : forks, spine).forEach((ci, k) => {
    const from = spine ? pointAtY(path, Math.min(Math.max(clumps[ci].c[1] * 0.85, F.SPINE_BRANCH_MIN * H), endY * 0.92)) : end;
    const r0 = rads[spine ? Math.round((from[1] / endY) * (path.length - 1)) : path.length - 1] * F.BRANCH_START_RADIUS;
    const pts = branchPath(R, from, clumps[ci], k), br = tubeMesh(pts, pts.map((_, i) => r0 * (1 - (1 - F.BRANCH_TAPER) * (i / (pts.length - 1)))));
    emit(wood, br, 1 + k, R, F.WOOD_TONE_SPREAD, 0, (f) => pts[Math.floor(f[0] / F.SIDES)]);
    tips.push(pts[pts.length - 1]);
  });
  return finish(crown, wood, clumps, tips, { radius: base, endY }, closedMeshes, H);
}
