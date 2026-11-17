// Seeded random, value noise and small geometry helpers. Pure functions; no scene state.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const at = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(at(0, 0, 0), at(1, 0, 0), xf), lerp(at(0, 1, 0), at(1, 1, 0), xf), yf),
    lerp(lerp(at(0, 0, 1), at(1, 0, 1), xf), lerp(at(0, 1, 1), at(1, 1, 1), xf), yf),
    zf,
  );
}

export function fbm(x, y, z, octaves = 4) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x, y, z);
    norm += amp;
    x *= 2.03; y *= 2.03; z *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Gives a geometry the two vertex attributes every surface in the world uses: aCol and aGlow. */
export function tint(geo, color, glow = 0, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, n = p.count;
  const cols = new Float32Array(n * 3), glows = new Float32Array(n);
  const base = new THREE.Color(color), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    tmp.copy(base);
    if (fn) fn(tmp, p.getX(i), p.getY(i), p.getZ(i));
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    glows[i] = glow;
  }
  g.setAttribute('aCol', new THREE.BufferAttribute(cols, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(glows, 1));
  return g;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function place(geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  geo.applyMatrix4(_m.compose(V3(x, y, z), _q, V3(sx, sy, sz)));
  return geo;
}

export const merge = (list) => mergeGeometries(list, false);

/** Tapered tube along points. radii[i] may be a number or (angle) => number. */
export function tube(points, radii, sides = 8) {
  const pos = [], idx = [];
  const ref = V3(0, 0, 1), t = V3(), nrm = V3(), bin = V3();
  for (let i = 0; i < points.length; i++) {
    const a = points[Math.max(i - 1, 0)], b = points[Math.min(i + 1, points.length - 1)];
    t.subVectors(b, a).normalize();
    nrm.crossVectors(t, ref);
    if (nrm.lengthSq() < 0.001) nrm.set(1, 0, 0);
    nrm.normalize();
    bin.crossVectors(t, nrm).normalize();
    for (let j = 0; j < sides; j++) {
      const ang = (j / sides) * Math.PI * 2;
      const r = typeof radii[i] === 'function' ? radii[i](ang) : radii[i];
      const c = Math.cos(ang) * r, s = Math.sin(ang) * r;
      pos.push(points[i].x + nrm.x * c + bin.x * s, points[i].y + nrm.y * c + bin.y * s, points[i].z + nrm.z * c + bin.z * s);
    }
    if (i < points.length - 1) {
      for (let j = 0; j < sides; j++) {
        const k = i * sides + j, k2 = i * sides + ((j + 1) % sides);
        idx.push(k, k + sides, k2, k2, k + sides, k2 + sides);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A lumpy ball with soft radial normals: foliage puffs, boulders, shards. */
export function blob(seed, lump = 0.25, freq = 1.3, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position, nor = g.attributes.normal, v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const k = 1 + (fbm(v.x * freq + seed, v.y * freq, v.z * freq + seed * 1.7, 3) - 0.5) * 2 * lump;
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}
