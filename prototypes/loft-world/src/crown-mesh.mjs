// One continuous crown surface: the smooth union of a tree kind's blobs, extracted once with surface nets.
// Pure (no three.js). A blob is { c:[x,y,z], r:[rx,ry,rz], yaw } (an ellipsoid turned about the y axis).
import { CROWN_BLEND, CROWN_CELL, CROWN_CELL_GROWTH, CROWN_REACH, CROWN_PAD_CELLS, CROWN_SHRINK } from './tree-variety-data.mjs';

const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

const meanRadius = (blobs) => blobs.reduce((s, b) => s + (b.r[0] + b.r[1] + b.r[2]) / 3, 0) / blobs.length;

/** Approximate signed distance to one ellipsoid blob (negative inside). */
export function blobDistance(b, x, y, z) {
  const dx = x - b.c[0], dy = y - b.c[1], dz = z - b.c[2], cs = Math.cos(b.yaw || 0), sn = Math.sin(b.yaw || 0);
  const lx = (dx * cs - dz * sn) / b.r[0], ly = dy / b.r[1], lz = (dx * sn + dz * cs) / b.r[2];
  return (Math.hypot(lx, ly, lz) - 1) * Math.min(b.r[0], b.r[1], b.r[2]);
}

/** Smooth union of all blobs (exponential smooth-minimum, blend radius k), pulled in by `shrink`. Negative inside. */
export function fieldValue(blobs, x, y, z, k, shrink = 0) {
  let min = Infinity;
  const d = blobs.map((b) => { const v = blobDistance(b, x, y, z); if (v < min) min = v; return v; });
  let sum = 0;
  for (const v of d) sum += Math.exp(-(v - min) / k);
  return min - k * Math.log(sum) + shrink;
}

/** Share of each blob at a point (sums to 1): the weights the smooth union implies. */
export function crownScale(blobs) {
  const mean = meanRadius(blobs);
  return { k: CROWN_BLEND * mean, shrink: CROWN_SHRINK * mean, cell: CROWN_CELL * mean };
}

const prep = (b, k) => ({ ...b, cs: Math.cos(b.yaw || 0), sn: Math.sin(b.yaw || 0), rmin: Math.min(...b.r), reach: Math.max(...b.r) + CROWN_REACH * k });
/** Local scaled offset of a point from a prepared blob. */
const local = (b, x, y, z, out) => {
  const dx = x - b.c[0], dz = z - b.c[2];
  out[0] = (dx * b.cs - dz * b.sn) / b.r[0]; out[1] = (y - b.c[1]) / b.r[1]; out[2] = (dx * b.sn + dz * b.cs) / b.r[2];
};

/** Field grid: the smooth union is -k ln(sum exp(-d/k)), so each blob adds its term only inside its reach. */
function sampleGrid(blobs, lo, n, cell, k, shrink) {
  const sum = new Float64Array(n[0] * n[1] * n[2]), q = [0, 0, 0], at = (i, j, l) => (i * n[1] + j) * n[2] + l;
  for (const b of blobs) {
    const a0 = [0, 1, 2].map((a) => Math.max(0, Math.floor((b.c[a] - b.reach - lo[a]) / cell)));
    const a1 = [0, 1, 2].map((a) => Math.min(n[a] - 1, Math.ceil((b.c[a] + b.reach - lo[a]) / cell)));
    for (let i = a0[0]; i <= a1[0]; i++) for (let j = a0[1]; j <= a1[1]; j++) for (let l = a0[2]; l <= a1[2]; l++) {
      local(b, lo[0] + i * cell, lo[1] + j * cell, lo[2] + l * cell, q);
      const d = (Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2]) - 1) * b.rmin;
      if (d < CROWN_REACH * k) sum[at(i, j, l)] += Math.exp(-d / k);
    }
  }
  const f = new Float32Array(sum.length);
  for (let id = 0; id < f.length; id++) f[id] = sum[id] > 0 ? -k * Math.log(sum[id]) + shrink : cell * n[0];
  return f;
}

/** Per vertex, in one pass: the nearby blobs' shares (smooth-union weights) and the field gradient as a unit normal. */
function vertexInfo(blobs, x, y, z, k) {
  const near = [], q = [0, 0, 0], g = [0, 0, 0];
  let min = Infinity, sum = 0;
  for (let j = 0; j < blobs.length; j++) {
    const b = blobs[j];
    local(b, x, y, z, q);
    const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2]), d = (len - 1) * b.rmin;
    if (d >= CROWN_REACH * k) continue;
    near.push([j, d, q[0] / len / b.r[0], q[1] / len / b.r[1], q[2] / len / b.r[2]]);
    if (d < min) min = d;
  }
  for (const e of near) { e.w = Math.exp(-(e[1] - min) / k); sum += e.w; }
  const shares = near.map((e) => [e[0], e.w / sum]);
  for (const e of near) {
    const b = blobs[e[0]], s = e.w / sum * b.rmin;
    g[0] += s * (e[2] * b.cs + e[4] * b.sn); g[1] += s * e[3]; g[2] += s * (-e[2] * b.sn + e[4] * b.cs);
  }
  const len = Math.hypot(g[0], g[1], g[2]) || 1;
  return { shares, normal: [g[0] / len, g[1] / len, g[2] / len] };
}

function surfaceNets(f, lo, n, cell) {
  const at = (i, j, l) => (i * n[1] + j) * n[2] + l, verts = [], cellVert = new Int32Array(n[0] * n[1] * n[2]).fill(-1);
  for (let i = 0; i < n[0] - 1; i++) for (let j = 0; j < n[1] - 1; j++) for (let l = 0; l < n[2] - 1; l++) {
    const v = CORNERS.map(([a, b, c]) => f[at(i + a, j + b, l + c)]);
    if (v.every((s) => s < 0) || v.every((s) => s >= 0)) continue;
    const p = [0, 0, 0]; let cnt = 0;
    for (const [a, b] of EDGES) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      for (let ax = 0; ax < 3; ax++) p[ax] += CORNERS[a][ax] + t * (CORNERS[b][ax] - CORNERS[a][ax]);
      cnt++;
    }
    cellVert[at(i, j, l)] = verts.length / 3;
    verts.push(lo[0] + (i + p[0] / cnt) * cell, lo[1] + (j + p[1] / cnt) * cell, lo[2] + (l + p[2] / cnt) * cell);
  }
  return { verts, cellVert, at };
}

const QUAD = [[-1, -1], [0, -1], [0, 0], [-1, 0]];
function quads(f, n, { cellVert, at }) {
  const idx = [], stride = [n[1] * n[2], n[2], 1];
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let l = 0; l < n[2]; l++) {
    const id = at(i, j, l), p = [i, j, l];
    for (let ax = 0; ax < 3; ax++) {
      if (p[ax] + 1 >= n[ax] || p[(ax + 1) % 3] < 1 || p[(ax + 2) % 3] < 1) continue;
      const inA = f[id] < 0;
      if (inA === (f[id + stride[ax]] < 0)) continue;
      const u = stride[(ax + 1) % 3], v = stride[(ax + 2) % 3];
      const ring = QUAD.map(([a, b]) => cellVert[id + a * u + b * v]);
      if (ring.some((c) => c < 0)) continue;
      if (!inA) ring.reverse();
      idx.push(ring[0], ring[1], ring[2], ring[0], ring[2], ring[3]);
    }
  }
  return idx;
}

/** Builds { positions, normals, shares, indices, triangleCount, k }. Coarsens the grid until it fits maxTriangles.
 * shares[i] is [[blobIndex, weight], ...] for vertex i, so the caller can blend any per-blob attribute. */
export function extractCrown(blobs, { maxTriangles = Infinity, cellScale = 1 } = {}) {
  const { k, shrink, cell: base } = crownScale(blobs), pb = blobs.map((b) => prep(b, k));
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of blobs) for (let a = 0; a < 3; a++) {
    const r = Math.max(...b.r); lo[a] = Math.min(lo[a], b.c[a] - r); hi[a] = Math.max(hi[a], b.c[a] + r);
  }
  for (let cell = base * cellScale; ; cell *= CROWN_CELL_GROWTH) {
    const pad = CROWN_PAD_CELLS * cell, org = lo.map((v) => v - pad - k);
    const n = hi.map((v, a) => Math.ceil((v + pad + k - org[a]) / cell) + 1);
    const f = sampleGrid(pb, org, n, cell, k, shrink), net = surfaceNets(f, org, n, cell), indices = quads(f, n, net);
    if (indices.length / 3 > maxTriangles) continue;
    const positions = Float32Array.from(net.verts), normals = new Float32Array(positions.length), shares = [];
    for (let v = 0; v < positions.length; v += 3) {
      const info = vertexInfo(pb, positions[v], positions[v + 1], positions[v + 2], k);
      normals.set(info.normal, v); shares.push(info.shares);
    }
    return { positions, normals, shares, indices: Uint32Array.from(indices), triangleCount: indices.length / 3, k };
  }
}
