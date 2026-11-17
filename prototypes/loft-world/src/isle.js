// A floating isle: an irregular grassy top, an earth lip, banded rock tapering to a point, crystals below.
import * as THREE from 'three';
import { softMaterial } from './glsl.js';
import { V3, blob, fbm, merge, place, rng, tint } from './util.js';

const GRASS_A = new THREE.Color('#2f6534'), GRASS_B = new THREE.Color('#4d8a3c');
const LIP = new THREE.Color('#2a5230'), EARTH = new THREE.Color('#6a4732');
const ROCK_A = new THREE.Color('#5b4b70'), ROCK_B = new THREE.Color('#8a7391'), ROCK_DEEP = new THREE.Color('#241b3d');
const SAND = new THREE.Color('#e3c58e');

/**
 * o: { r, depth, seed, pos:[x,y,z], seg?, bump?, sand?:(x,z)=>0..1, crystals? }
 * Returns { group, r, pos, heightAt(x,z), outline(theta), inside(x,z,margin), edge(theta, inset) } in isle-local x,z.
 */
export function makeIsle(o) {
  const { r, depth, seed } = o;
  const SEG = o.seg || 96, RT = o.rings || 12, RB = 20;
  const bump = o.bump ?? r * 0.05;
  const outline = (th) => r * (0.8 + 0.38 * fbm(Math.cos(th) * 1.4 + seed, Math.sin(th) * 1.4, seed * 3.7, 3));
  const rawHeight = (x, z) => {
    const f = Math.min(Math.hypot(x, z) / outline(Math.atan2(z, x)), 1);
    return (fbm(x * 0.09 + seed, z * 0.09, seed, 3) - 0.5) * 2 * bump * (1 - f * f * f) - Math.pow(f, 5) * r * 0.05;
  };
  // flats: [[x, z, radius, drop]] level the ground under a building or sink a basin for water.
  const flats = (o.flats || []).map(([x, z, rad, drop]) => ({ x, z, rad, y: rawHeight(x, z) - drop }));
  const heightAt = (x, z) => {
    let h = rawHeight(x, z);
    for (const f of flats) {
      const d = Math.hypot(x - f.x, z - f.z), w = 1 - Math.min(Math.max((d - f.rad) / (f.rad * 0.7), 0), 1);
      h += (f.y - h) * w * w * (3 - 2 * w);
    }
    return h;
  };

  const rows = RT + RB + 1, cols = SEG + 1;
  const pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 3), glow = new Float32Array(rows * cols);
  const c = new THREE.Color();
  for (let row = 0; row < rows; row++) {
    for (let s = 0; s < cols; s++) {
      const th = (s / SEG) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th), R0 = outline(th);
      let x, y, z;
      if (row <= RT) {
        const f = row / RT;
        x = cs * R0 * f; z = sn * R0 * f; y = heightAt(x, z);
        c.copy(GRASS_A).lerp(GRASS_B, fbm(x * 0.2, z * 0.2, seed + 5, 2));
        if (o.sand) c.lerp(o.sandColor ? SAND.clone().set(o.sandColor) : SAND, o.sand(x, z));
        if (f > 0.9) c.lerp(LIP, (f - 0.9) * 6);
      } else {
        const t = (row - RT) / RB;
        const nz = fbm(cs * 2.2 + seed, sn * 2.2, t * 2.5 + seed, 3);
        const ridge = 1 + 0.07 * Math.sin(th * 11 + nz * 9) * Math.sin(Math.min(t * 4, 1) * Math.PI * 0.5);
        const rad = R0 * Math.pow(1 - t, 0.6) * (1 + 0.07 * Math.sin(t * Math.PI)) * (1 + (nz - 0.5) * 0.55 * (1 - t)) * ridge;
        const ragged = 0.7 + 0.6 * fbm(cs * 3 + seed, sn * 3, seed + 9, 2);
        const mult = ragged + (1 - ragged) * t * t * t;
        x = cs * rad; z = sn * rad;
        y = heightAt(cs * R0, sn * R0) - depth * Math.pow(t, 0.8) * mult;
        if (t < 0.07) c.copy(LIP);
        else if (t < 0.17) c.copy(LIP).lerp(EARTH, (t - 0.07) * 10);
        else {
          const band = Math.pow(0.5 + 0.5 * Math.sin(y * 1.6 + nz * 6), 2);
          c.copy(ROCK_A).lerp(ROCK_B, band).lerp(EARTH, Math.max(0, 0.3 - t) * 2).lerp(ROCK_DEEP, Math.min(t * 0.9, 0.85));
          c.multiplyScalar(0.7 + 0.3 * Math.sin(th * 11 + nz * 9));
        }
      }
      const i = row * cols + s;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
  }
  const idx = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let s = 0; s < SEG; s++) {
      const a = row * cols + s, b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const group = new THREE.Group();
  group.position.set(...o.pos);
  group.add(new THREE.Mesh(geo, softMaterial()));

  // Hanging rock spikes and glowing crystals give the underside a silhouette.
  const R = rng(seed * 977 + 3), under = [];
  const spikes = o.crystals ?? Math.round(r * 0.9);
  for (let i = 0; i < spikes; i++) {
    const th = R() * Math.PI * 2, f = 0.15 + R() * 0.6, rad = outline(th) * f;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    const y = -depth * Math.pow(1 - f, 0.9) * 0.62 - 0.5;
    const len = (1.2 + R() * 3) * (r / 18 + 0.4);
    const isCrystal = R() < 0.42;
    const g = new THREE.ConeGeometry(isCrystal ? 0.28 + R() * 0.25 : 0.6 + R() * 0.9, len, isCrystal ? 5 : 7);
    const shade = isCrystal ? (R() < 0.6 ? '#63f2d4' : '#ff9fd8') : '#3c2f56';
    under.push(place(tint(g, shade, isCrystal ? 0.8 : 0), x, y - len / 2, z, Math.PI + (R() - 0.5) * 0.5, R() * 6, (R() - 0.5) * 0.5));
  }
  if (under.length) group.add(new THREE.Mesh(merge(under), softMaterial()));

  const inside = (x, z, margin = 0) => Math.hypot(x, z) < outline(Math.atan2(z, x)) - margin;
  const edge = (th, inset = 0.9) => {
    const rad = outline(th) * inset, x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    return V3(x + o.pos[0], heightAt(x, z) + o.pos[1], z + o.pos[2]);
  };
  return { group, r, depth, pos: o.pos, heightAt, outline, inside, edge };
}

/** Boulders with mossy tops, sitting on an isle. spots: [[x,z,size], ...] in isle-local coords. */
export function boulders(isle, spots, seed) {
  const parts = spots.map(([x, z, s], i) => {
    const g = blob(seed + i * 3.1, 0.3, 1.6, 1);
    return place(
      tint(g, '#7a6a86', 0, (cc, _x, y) => { if (y > 0.35) cc.lerp(GRASS_B, Math.min((y - 0.35) * 3, 1)); else cc.multiplyScalar(0.6 + 0.4 * (y + 1)); }),
      x, isle.heightAt(x, z) + s * 0.35, z, 0, i * 1.7, 0, s, s * 0.72, s * 0.9,
    );
  });
  return new THREE.Mesh(merge(parts), softMaterial());
}
