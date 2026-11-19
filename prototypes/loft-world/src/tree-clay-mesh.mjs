// Smooth mesh pieces for clay trees. Pure: indexed meshes { verts, faces, normals, ... } with area-weighted smooth normals,
// closed where they are solids (sphere, petal). Numbers live in tree-clay-data.mjs.
import { CLAY_CLUMP as C, CLAY_PINE as P, SPHERE_SEG_PER_RING } from './tree-clay-data.mjs';

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
export const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Smooth vertex normals: face normals (area weighted) summed on shared vertices. */
export function smoothNormals(verts, faces) {
  const n = verts.map(() => [0, 0, 0]);
  for (const f of faces) {
    const fn = cross(sub(verts[f[1]], verts[f[0]]), sub(verts[f[2]], verts[f[0]]));
    for (const i of f) n[i] = add(n[i], fn);
  }
  return n.map(norm);
}

/** Turns every face around when most of them point toward `inside` (so normals face outward), then adds normals. */
function finishSolid(verts, faces, inside) {
  let out = 0;
  for (const f of faces) { const a = verts[f[0]], fn = cross(sub(verts[f[1]], a), sub(verts[f[2]], a)); out += dot(fn, sub(a, inside)) > 0 ? 1 : -1; }
  const fixed = out < 0 ? faces.map(([a, b, c]) => [a, c, b]) : faces;
  return { verts, faces: fixed, normals: smoothNormals(verts, fixed) };
}

/** Wrapped grid solid: poles at both ends and `rings - 1` rings of `seg` vertices; pos(r, j) gives ring r (1..rings-1), column j. */
function poleGrid(rings, seg, top, bottom, pos) {
  const verts = [top], faces = [], at = (r, j) => 1 + (r - 1) * seg + (j % seg);
  for (let r = 1; r < rings; r++) for (let j = 0; j < seg; j++) verts.push(pos(r, j));
  const last = verts.length;
  verts.push(bottom);
  for (let j = 0; j < seg; j++) faces.push([0, at(1, j), at(1, j + 1)], [last, at(rings - 1, j + 1), at(rings - 1, j)]);
  for (let r = 1; r < rings - 1; r++) for (let j = 0; j < seg; j++) faces.push([at(r, j), at(r + 1, j), at(r, j + 1)], [at(r, j + 1), at(r + 1, j), at(r + 1, j + 1)]);
  return { verts, faces };
}

/** Rings and columns of a UV sphere that spend about `tris` triangles. */
export function sphereGrid(tris) {
  const rings = Math.max(3, Math.round(Math.sqrt(tris / (2 * SPHERE_SEG_PER_RING)) + 1));
  return { rings, seg: Math.max(5, Math.round(rings * SPHERE_SEG_PER_RING)) };
}

/** One leafy clump: a rounded ellipsoid (spec {c, r, yaw}) with a few low-frequency radial waves; spec.lumps (same fields
 * as CLAY_CLUMP) overrides their strength and count, so a kind can grow lumpy clusters instead of smooth eggs. */
export function clayClump(R, spec, tris) {
  const { rings, seg } = sphereGrid(tris), cs = Math.cos(spec.yaw || 0), sn = Math.sin(spec.yaw || 0), w = spec.lumps || C;
  const waves = Array.from({ length: w.WAVES }, () => ({ ax: norm([R() - 0.5, R() - 0.5, R() - 0.5]), f: w.FREQ_LO + R() * (w.FREQ_HI - w.FREQ_LO), ph: R() * 6.3 }));
  const place = (d) => {
    const k = 1 + (w.BUMP / w.WAVES) * waves.reduce((s, w) => s + Math.sin(w.f * dot(d, w.ax) + w.ph), 0), lx = d[0] * k * spec.r[0], lz = d[2] * k * spec.r[2];
    return [spec.c[0] + lx * cs + lz * sn, spec.c[1] + d[1] * k * spec.r[1], spec.c[2] - lx * sn + lz * cs];
  };
  const dir = (r, j) => { const phi = (Math.PI * r) / rings, th = (j / seg) * Math.PI * 2; return [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)]; };
  const g = poleGrid(rings, seg, place([0, 1, 0]), place([0, -1, 0]), (r, j) => place(dir(r, j)));
  return { ...finishSolid(g.verts, g.faces, spec.c), spec };
}

/** Frame of a petal at ring u: centre point, side vector S, thickness vector N (outward and up). */
function petalFrame(o, u) {
  const point = (t) => { const rho = o.rho0 + (o.rho1 - o.rho0) * t; return [Math.cos(o.a) * rho, o.y0 + (o.y1 - o.y0) * t - o.drop * t * t, Math.sin(o.a) * rho]; };
  const c = point(u), t = norm(sub(point(Math.min(u + 0.02, 1)), point(Math.max(u - 0.02, 0)))), s = [-Math.sin(o.a), 0, Math.cos(o.a)];
  let n = norm(cross(s, t)); if (dot(n, [Math.cos(o.a), 1, Math.sin(o.a)]) < 0) n = mul(n, -1);
  return { c, s, n };
}

/** One petal: a smooth tongue from (rho0, y0) under the tier above to a rounded tip (rho1, y1) at azimuth `a`, drooping by `drop`,
 * thickest and widest past its middle. Returns a closed mesh plus per-vertex {u, th} (length 0..1, around the section). */
export function clayPetal(o, U, V) {
  const ringU = (k) => 1 - Math.pow(1 - k / U, P.TIP_BIAS), frames = Array.from({ length: U + 1 }, (_, k) => petalFrame(o, ringU(k))), params = [{ u: 0, th: 0 }];
  const wid = (u) => o.half * Math.pow(Math.max(Math.sin(Math.PI * Math.pow(u, P.WIDTH_PEAK)), 0), P.TIP_ROUND);
  const at = (r, j) => { const u = ringU(r), th = (j / V) * Math.PI * 2, f = frames[r], w = wid(u); params.push({ u, th }); return add(f.c, add(mul(f.s, Math.cos(th) * w), mul(f.n, Math.sin(th) * w * P.THICK))); };
  const g = poleGrid(U, V, frames[0].c, frames[U].c, at);
  params.push({ u: 1, th: 0 });
  const mid = frames[Math.floor(U / 2)].c;
  return { ...finishSolid(g.verts, g.faces, mid), params, a: o.a };
}

/** Tube along `points`; radiusAt(i, angle) gives the radius of ring i at that angle (a toe, a flare). Open ends, smooth normals. */
export function clayTube(points, radiusAt, sides) {
  const verts = [], faces = [];
  points.forEach((p, i) => {
    const t = norm(sub(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]));
    let u = cross(t, [0, 0, 1]); if (Math.hypot(...u) < 0.01) u = [1, 0, 0];
    u = norm(u); const v = cross(t, u);
    for (let j = 0; j < sides; j++) { const a = (j / sides) * Math.PI * 2, r = radiusAt(i, a); verts.push(add(p, add(mul(u, Math.cos(a) * r), mul(v, Math.sin(a) * r)))); }
  });
  for (let i = 0; i < points.length - 1; i++) for (let j = 0; j < sides; j++) {
    const A = i * sides + j, B = i * sides + ((j + 1) % sides), D = B + sides, E = A + sides;
    faces.push([A, B, E], [B, D, E]);
  }
  const centre = points[Math.floor(points.length / 2)], fixed = finishSolid(verts, faces, centre);
  return { ...fixed, points };
}

/** True when every edge is shared by exactly two faces. */
export function closed(faces) {
  const count = new Map();
  for (const [a, b, c] of faces) for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = p < q ? `${p},${q}` : `${q},${p}`; count.set(k, (count.get(k) || 0) + 1); }
  return [...count.values()].every((n) => n === 2);
}

export const newOut = () => ({ positions: [], normals: [], tone: [], part: [], light: [], index: [] });

/** Appends a mesh; tone(i) and light(i) give vertex i's tone and baked light. */
export function packMesh(out, mesh, part, tone, light) {
  const base = out.positions.length / 3;
  mesh.verts.forEach((p, i) => { out.positions.push(...p); out.normals.push(...mesh.normals[i]); out.tone.push(tone(i)); out.part.push(part); out.light.push(light(i)); });
  for (const f of mesh.faces) out.index.push(base + f[0], base + f[1], base + f[2]);
}

/** Typed arrays of a build; leafBase (tree-leaves.mjs) is zero on every vertex that is not a leaf. */
export const freeze = (m) => ({ positions: Float32Array.from(m.positions), normals: Float32Array.from(m.normals), tone: Float32Array.from(m.tone), part: Float32Array.from(m.part), light: Float32Array.from(m.light), index: Uint32Array.from(m.index), leafBase: m.leafBase ? Float32Array.from(m.leafBase) : new Float32Array(m.positions.length) });
