// Dressing that makes each of the four places a showpiece, and fills the ground between them:
// lamp-lit paths, a lantern dock and floating lights on the lake, a strung-up camp, crystal spires on the
// sky island, and bushes, ferns and glow mushrooms through the woods.
import * as THREE from 'three';
import { softMaterial } from './glsl.js';
import { leafGeometry } from './woodland-view.js';
import { mushrooms } from './flora.js';
import { V3, blob, fbm, merge, place, rng, tint } from './util.js';

export const DRESS = {
  lampEvery: 18, // world units between path lamps
  lampOff: 2.4, // how far a lamp stands from the middle of the path
  lakeLanterns: 12,
  lilyPads: 46,
  spires: 12,
  bushes: [360, 150], // desktop, phone
  ferns: [1400, 500],
  glowShrooms: [380, 140],
  dock: [3.5, 34, 13], // direction from the lake centre (radians), start and end distance from the centre
};

const AMBER = '#ffb04f', DARK = '#2c2130', TIMBER = '#5a3a28';
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
const instanced = (scene, geo, count, mat) => { const m = new THREE.InstancedMesh(geo, mat, count); m.frustumCulled = false; scene.add(m); return m; };

/** o: { scene, terrain, LAND, CAFE, CAMP, glade, treeSpots, low }. Returns { ramps, update(time) }. */
export function dressValley(o) {
  const { scene, terrain, LAND, CAMP, glade, low } = o, H = terrain.heightAt, R = rng(2026);
  const tier = low ? 1 : 0, ramps = [];
  const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(), sc = V3();
  const clearOf = (x, z) => { const m = terrain.maskAt(x, z); return m.path < 0.05 && m.sand < 0.2 && m.wet < 0.05; };

  // ---- Lamps along every path: the valley's roads glow at dusk ----
  const lamps = [], lampSpots = []; // lampSpots: ground positions, for the baked light map
  let side = 1;
  for (const line of LAND.paths) {
    for (let s = 0; s < line.length - 1; s++) {
      const [ax, az] = line[s], [bx, bz] = line[s + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / DRESS.lampEvery));
      const px = -(bz - az) / len, pz = (bx - ax) / len;
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n; side = -side;
        const x = ax + (bx - ax) * f + px * DRESS.lampOff * side, z = az + (bz - az) * f + pz * DRESS.lampOff * side, y = H(x, z);
        const yaw = Math.atan2(-px * side, -pz * side); // the arm reaches back over the path
        lampSpots.push({ x, y, z });
        lamps.push(place(tint(cyl(0.07, 0.1, 3.3, 6), DARK), x, y + 1.65, z));
        lamps.push(place(tint(box(0.08, 0.08, 0.8), DARK), x + Math.sin(yaw) * 0.36, y + 3.25, z + Math.cos(yaw) * 0.36, 0, yaw));
        lamps.push(place(tint(new THREE.SphereGeometry(0.24, 10, 8), AMBER, 1), x + Math.sin(yaw) * 0.72, y + 2.92, z + Math.cos(yaw) * 0.72, 0, 0, 0, 1, 1.25, 1));
        lamps.push(place(tint(new THREE.ConeGeometry(0.3, 0.2, 8), DARK), x + Math.sin(yaw) * 0.72, y + 3.27, z + Math.cos(yaw) * 0.72));
      }
    }
  }
  scene.add(new THREE.Mesh(merge(lamps), softMaterial({ fuzz: 0.1 })));

  // ---- Loft garden: where you start. Kept tidy: round topiary along the path, one string of warm bulbs to the tree ----
  const garden = [], [gx, gz] = o.LOFT, door = V3(gx + 0.4, 0, gz + 5.2);
  for (let k = 0; k < 3; k++) for (const sgn of [-1, 1]) {
    const x = door.x + sgn * 3.8 + k * 3, z = door.z - sgn * 3.3 + 2 + k * 3.45, y = H(x, z), size = 0.65;
    garden.push(place(tint(blob(40 + k + sgn, 0.05, 2, 2), '#ffffff', 0, (c, _x, py) => c.set('#285c42').lerp(new THREE.Color('#65976a'), Math.min(Math.max(py * 0.6 + 0.5, 0), 1))), x, y + 0.5, z, 0, k, 0, size, size, size));
  }
  scene.add(new THREE.Mesh(merge(garden), softMaterial({ fuzz: 1, leaf: 2.6 })));
  const string = [], from = V3(gx - 0.5, H(gx, gz) + 9.2, gz + 1.5), to = V3(o.TREE[0] + 1.2, o.treeTop - 4, o.TREE[1] + 1.5);
  for (let k = 1; k < 12; k++) { const f = k / 12, sag = Math.sin(f * Math.PI) * 1.6; string.push(place(tint(new THREE.SphereGeometry(0.15, 8, 6), k % 3 ? AMBER : '#ffd9a8', 0.9), from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f - sag, from.z + (to.z - from.z) * f)); }
  scene.add(new THREE.Mesh(merge(string), softMaterial({ fuzz: 0 })));

  // ---- Lake: a lantern dock you can walk out on, drifting lights, lily pads ----
  const [lx, lz] = LAND.lake, water = LAND.water, [da, d0, d1] = DRESS.dock;
  const dockY = water + 0.62, a = V3(lx + Math.cos(da) * d0, dockY, lz + Math.sin(da) * d0), b = V3(lx + Math.cos(da) * d1, dockY, lz + Math.sin(da) * d1);
  const dock = [], dLen = a.distanceTo(b), yawD = Math.atan2(b.x - a.x, b.z - a.z), sx = Math.cos(yawD), sz = -Math.sin(yawD);
  for (let i = 0; i <= dLen / 0.62; i++) {
    const f = i * 0.62 / dLen, x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
    dock.push(place(tint(box(2.3, 0.1, 0.52), '#c9a57a', 0, (c) => c.multiplyScalar(0.75 + R() * 0.25)), x, dockY, z, 0, yawD, (R() - 0.5) * 0.04));
    if (i % 5 === 0) for (const sgn of [1, -1]) {
      const px = x + sx * 1.15 * sgn, pz = z + sz * 1.15 * sgn, tall = i % 10 === 0;
      dock.push(place(tint(cyl(0.09, 0.11, tall ? 4.6 : 2.6, 6), TIMBER), px, dockY + (tall ? 0.6 : -0.4), pz));
      if (tall) dock.push(place(tint(new THREE.SphereGeometry(0.22, 10, 8), i % 20 === 0 ? AMBER : '#ff9fd8', 1), px, dockY + 3.05, pz, 0, 0, 0, 1, 1.25, 1));
    }
  }
  // a round end to stand on, with a little bench
  dock.push(place(tint(cyl(2.4, 2.4, 0.12, 20), '#c9a57a'), b.x, dockY, b.z));
  dock.push(place(tint(box(1.6, 0.14, 0.5), TIMBER), b.x, dockY + 0.55, b.z, 0, yawD + Math.PI / 2));
  scene.add(new THREE.Mesh(merge(dock), softMaterial({ fuzz: 0.2 })));
  ramps.push({ points: [a, b, b.clone().addScaledVector(V3(b.x - a.x, 0, b.z - a.z).normalize(), 2.2)], width: 1.25, box: [Math.min(a.x, b.x) - 4, Math.max(a.x, b.x) + 4, Math.min(a.z, b.z) - 4, Math.max(a.z, b.z) + 4] });

  const lanternGeo = merge([
    place(tint(cyl(0.3, 0.24, 0.42, 10), '#ffc27a', 0.9), 0, 0.26, 0),
    place(tint(cyl(0.36, 0.36, 0.05, 10), '#f6e6c8'), 0, 0.03, 0),
  ]);
  const floats = [], floatMesh = instanced(scene, lanternGeo, DRESS.lakeLanterns, softMaterial({ fuzz: 0 }));
  for (let i = 0; i < DRESS.lakeLanterns; i++) floats.push({ a: R() * 6.28, r: 5 + Math.sqrt(R()) * 20, w: (R() - 0.5) * 0.03, ph: R() * 6 });
  const pads = [];
  for (let i = 0; i < DRESS.lilyPads; i++) {
    const ang = R() * 6.28, rad = 17 + R() * 9, x = lx + Math.cos(ang) * rad, z = lz + Math.sin(ang) * rad, size = 0.5 + R() * 0.5;
    if (H(x, z) > water - 0.4) continue;
    pads.push(place(tint(new THREE.CircleGeometry(size, 12, 0.3, 5.7), '#3f8a55', 0, (c) => c.multiplyScalar(0.8 + R() * 0.3)), x, water + 0.04, z, -Math.PI / 2, R() * 6));
    if (i % 4 === 0) pads.push(place(tint(new THREE.ConeGeometry(0.2, 0.3, 7), '#ff9fd8', 0.45), x, water + 0.2, z, Math.PI));
  }
  scene.add(new THREE.Mesh(merge(pads), softMaterial({ fuzz: 0.2 })));

  // ---- Camp: more tents, stump seats, and a ring of lights strung between poles ----
  const camp = [], cy = H(...CAMP), cx = CAMP[0], cz = CAMP[1];
  for (const [dx, dz, hue, yaw] of [[5.6, -4.2, '#e9604c', 2.2], [-6.4, 3.4, '#3e8f8a', 0.4]]) {
    camp.push(place(tint(new THREE.ConeGeometry(2.2, 2.7, 4), hue, 0, (c, _x, py) => c.lerp(new THREE.Color('#fbe7c0'), Math.max(py / 2.7 + 0.2, 0) * 0.5)), cx + dx, H(cx + dx, cz + dz) + 1.3, cz + dz, 0, yaw));
    camp.push(place(tint(new THREE.SphereGeometry(0.15, 8, 6), AMBER, 1), cx + dx, H(cx + dx, cz + dz) + 1.2, cz + dz));
  }
  for (let k = 0; k < 4; k++) { const ang = k * 1.5 + 0.4; camp.push(place(tint(cyl(0.42, 0.46, 0.5, 9), '#6a4630'), cx + 1.6 + Math.cos(ang) * 2.6, cy + 0.25, cz + 1.6 + Math.sin(ang) * 2.6)); }
  const poles = [0, 1, 2, 3, 4].map((k) => { const ang = k / 5 * 6.283 + 0.3, x = cx + Math.cos(ang) * 8.5, z = cz + Math.sin(ang) * 8.5; return V3(x, H(x, z) + 4.4, z); });
  const bulbs = [AMBER, '#ff8fb8', '#8ff5e0', '#ffe08a'];
  poles.forEach((p, i) => {
    camp.push(place(tint(cyl(0.07, 0.09, 4.4, 6), TIMBER), p.x, p.y - 2.2, p.z));
    const q2 = poles[(i + 1) % poles.length];
    for (let k = 1; k < 10; k++) { const f = k / 10, sag = Math.sin(f * Math.PI) * 1.1; camp.push(place(tint(new THREE.SphereGeometry(0.13, 6, 5), bulbs[(k + i) % 4], 1), p.x + (q2.x - p.x) * f, p.y + (q2.y - p.y) * f - sag, p.z + (q2.z - p.z) * f)); }
  });
  scene.add(new THREE.Mesh(merge(camp), softMaterial({ fuzz: 0.3 })));

  // (The crystal spires around the sky island were removed 2026-11-17: too sharp and too bright.)

  // ---- Undergrowth: bushes and ferns thicken toward the woods; glow mushrooms gather under the trees ----
  const woods = (x, z) => fbm(x * 0.018 + 6, z * 0.018, 3.3, 2) + (z < -45 ? 0.1 : 0) + (Math.hypot(x, z) > 140 ? 0.12 : 0);
  const keepOut = [[0, 0, 11], [o.CAFE[0], o.CAFE[1], 9], [cx, cz, 9]];
  const free = (x, z) => clearOf(x, z) && !keepOut.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr) && H(x, z) > water + 1 && H(x, z) < 50;
  function scatter(mesh, count, reach, rule, size) {
    let n = 0;
    for (let tries = 0; n < count && tries < count * 14; tries++) {
      const x = (R() * 2 - 1) * reach, z = (R() * 2 - 1) * reach;
      if (!free(x, z) || !rule(x, z)) continue;
      const s = size();
      mesh.setMatrixAt(n++, m4.compose(V3(x, H(x, z) - 0.05, z), quat.setFromEuler(euler.set(0, R() * 6.28, 0)), sc.set(s, s * (0.8 + R() * 0.4), s)));
    }
    mesh.count = n;
  }
  const bushParts = [];
  for (let k = 0; k < 3; k++) {
    bushParts.push(place(tint(blob(70 + k, 0.04, 1.6, 3), '#ffffff', 0, (c, _x, y) => c.set('#356954').lerp(new THREE.Color('#83a57c'), Math.min(Math.max(y * 0.6 + 0.5, 0), 1))), (k - 1) * 0.55, 0.5 + (k % 2) * 0.18, (k % 2) * 0.4 - 0.2, 0, k, 0, 0.72 - k * 0.08, 0.6, 0.7));
  }
  scatter(instanced(scene, merge(bushParts), DRESS.bushes[tier], softMaterial({ sway: 0.4, leaf: .6 }) /* no detailRange: bushes grew out of the ground 77 to 110 units ahead while walking (owner, 2026-11-17) */), DRESS.bushes[tier], 175, (x, z) => woods(x, z) > 0.5 || R() < 0.18, () => 0.9 + R() * 1.2);

  // (Ferns were removed 2026-11-17 with the other pointed plants.)

  for (const [hue, share] of [['#7af5e0', 0.7], ['#ff9fd8', 0.3]]) {
    const count = Math.round(DRESS.glowShrooms[tier] * share), mesh = instanced(scene, mushrooms([[0, 0, 0, 1]], hue).geometry, count, softMaterial({ fuzz: 0, gloss: 0.6 }));
    let n = 0;
    for (let tries = 0; n < count && tries < count * 8 && o.treeSpots.length; tries++) {
      const [tx, , tz] = o.treeSpots[Math.floor(R() * o.treeSpots.length)], ang = R() * 6.28, d = 1.4 + R() * 3.2, x = tx + Math.cos(ang) * d, z = tz + Math.sin(ang) * d;
      if (!clearOf(x, z)) continue;
      const s = 0.9 + R() * 1.6;
      mesh.setMatrixAt(n++, m4.compose(V3(x, H(x, z), z), quat.identity(), sc.set(s, s, s)));
    }
    mesh.count = n;
  }

  return {
    ramps,
    lampSpots,
    /** The lake's lights drift slowly round and bob. */
    update(time) {
      floats.forEach((f, i) => {
        const ang = f.a + time * f.w;
        m4.compose(V3(lx + Math.cos(ang) * f.r, water + 0.02 + Math.sin(time * 1.1 + f.ph) * 0.04, lz + Math.sin(ang) * f.r), quat.setFromEuler(euler.set(Math.sin(time + f.ph) * 0.05, f.ph + time * 0.1, 0)), sc.set(1, 1, 1));
        floatMesh.setMatrixAt(i, m4);
      });
      floatMesh.instanceMatrix.needsUpdate = true;
    },
  };
}
