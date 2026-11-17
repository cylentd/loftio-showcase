// Composes the Plush Valley: what stands where. Layout numbers live here and in terrain.js (LAND) only.
import * as THREE from 'three';
import {makeTerrainProps} from './terrain-props.mjs';
import {buildWoodland} from './woodland-view.js';
import { G, softMaterial } from './glsl.js';
import { makeSky } from './sky.js';
import { boulders, makeIsle } from './isle.js';
import { makeGrass, makeTree, mushrooms, pines } from './flora.js';
import { lanterns, makeBridge, makeCafe, makeCamp, makeGlade, makeLoft } from './props.js';
import { Motes, makePond, makeStream } from './fx.js';
import { LAND, createTerrain } from './terrain.js';
import { V3, fbm, rng } from './util.js';
import { dressValley } from './scenery.js';
import { buildVillages } from './biome-villages.js';
import { forestBatches, FOREST_BATCH } from './forest-batches.mjs';

const TREE = [-7.5, -5], LOFT = [3.6, 0.4], LOFT_SCALE = 1.5;
const CAFE = [72, 63], CAMP = [-78, -28], GLADE = [20, 40, -105], POOL = [20, -82];
const SEA_Y = -18; // the cloud sea the mountains rise out of

export function buildWorld(scene, low) {
  makeSky(scene, SEA_Y);
  const motes = new Motes(5), R = rng(99);
  const terrain = createTerrain([[LOFT[0] + 1.5, LOFT[1], 8], [CAFE[0], CAFE[1], 8], [CAMP[0], CAMP[1], 9], [POOL[0], POOL[1], 5]], low);
  scene.add(terrain.group);
  const H = terrain.heightAt, ground = { heightAt: H };
  const solids = [], canopies = [];
  const terrainProps=makeTerrainProps(H),woodland=buildWoodland(scene,terrain,terrainProps);

  // ---- Loft knoll ------------------------------------------------------------------------------
  const tree = makeTree({ seed: 7, height: 18, girth: 1.8, leaf: 3.1, depth: 2, spread: 1, palette: ['#0e5a44', '#63c06a', '#d6e884'] });
  const treeGroup = new THREE.Group(), treeY = H(...TREE) - 0.3;
  treeGroup.position.set(TREE[0], treeY, TREE[1]);
  treeGroup.add(tree.wood, tree.leaves);
  scene.add(treeGroup);
  scene.add(lanterns(tree.tips.filter((_, i) => i % 3 === 0).map((t) => t.clone().add(treeGroup.position).add(V3(0, -1.5, 0))), 12));
  solids.push([TREE[0], TREE[1], 1.9, treeY + 14]);
  canopies.push([TREE[0]+tree.envelope.center.x,treeY+tree.envelope.center.y,TREE[1]+tree.envelope.center.z,tree.envelope.radius+.3,{group:treeGroup}]);

  const loft = makeLoft(), loftY = H(...LOFT);
  loft.scale.setScalar(LOFT_SCALE);
  loft.position.set(LOFT[0], loftY - 0.1, LOFT[1]);
  scene.add(loft);
  solids.push([LOFT[0], LOFT[1], 2.9 * LOFT_SCALE, loftY + 9 * LOFT_SCALE], [LOFT[0] + 3.5 * LOFT_SCALE, LOFT[1] - 0.7 * LOFT_SCALE, 1.9 * LOFT_SCALE, loftY + 6 * LOFT_SCALE]);

  const shrooms = [];
  for (let i = 0; i < 30; i++) {
    const a = R() * 6.28, d = 2.4 + R() * 3, x = TREE[0] + Math.cos(a) * d, z = TREE[1] + Math.sin(a) * d;
    shrooms.push([x, H(x, z), z, 0.7 + R() * 0.9]);
  }
  scene.add(mushrooms(shrooms));
  scene.add(boulders(ground, [[-14, 9, 1.5], [-17, -8, 2.1], [15, -10, 1.6], [-3, 16, 0.9], [22, 14, 1.2], [-26, 20, 1.8], [30, -22, 2.2], [48, 12, 1.4], [-52, 6, 1.7], [-34, -40, 2]], 4));

  // ---- Lake and beach cafe ---------------------------------------------------------------------
  const [lx, lz, lr] = LAND.lake;
  scene.add(makePond(lx, LAND.water, lz, lr * 1.55, terrain.uniforms));
  const cafeGroup = new THREE.Group();
  cafeGroup.position.set(CAFE[0], 0, CAFE[1]);
  cafeGroup.rotation.y = Math.atan2(lx - CAFE[0], lz - CAFE[1]); // the counter faces the lake
  const cafeY = H(...CAFE);
  cafeGroup.add(makeCafe(() => cafeY));
  scene.add(cafeGroup);
  solids.push([CAFE[0], CAFE[1], 3, cafeY + 3]);
  scene.add(boulders(ground, [[60, 50, 0.9], [96, 58, 1.2], [112, 40, 0.8], [66, 2, 1.1], [104, -2, 1.4]], 14));

  // ---- Creek -----------------------------------------------------------------------------------
  const creek = [];
  for (let s = 0; s < LAND.creek.length - 1; s++) {
    const [ax, az] = LAND.creek[s], [bx, bz] = LAND.creek[s + 1];
    for (let k = 0; k < 10; k++) {
      const f = k / 10, t = (s + f) / (LAND.creek.length - 1);
      creek.push(V3(ax + (bx - ax) * f, terrain.creekY(t) - 0.45, az + (bz - az) * f));
    }
  }
  creek.push(V3(...LAND.creek.at(-1), 0).set(LAND.creek.at(-1)[0], LAND.water + 0.02, LAND.creek.at(-1)[1]));
  scene.add(makeStream(creek, creek.length - 1, () => 2.6, 0.985));
  // a plank bridge where the camp path crosses the creek
  const creekA = V3(-37, H(-37, -11) + 0.2, -11), creekB = V3(-50, H(-50, -20) + 0.2, -20);
  scene.add(makeBridge(creekA, creekB, 5, 0.03));
  // A bridge you can walk on: the same sagging curve the planks follow, as a list of deck points.
  const rampOf = (a, b, sag) => {
    const mid = a.clone().lerp(b, 0.5); mid.y -= a.distanceTo(b) * sag;
    const points = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(44), xs = points.map((p) => p.x), zs = points.map((p) => p.z);
    return { points, width: 1.2, box: [Math.min(...xs) - 1.5, Math.max(...xs) + 1.5, Math.min(...zs) - 1.5, Math.max(...zs) + 1.5] };
  };
  const ramps = [rampOf(creekA, creekB, 0.03)];

  // ---- Camp ridge ------------------------------------------------------------------------------
  const campGroup = new THREE.Group(), campY = H(...CAMP);
  campGroup.position.set(CAMP[0], 0, CAMP[1]);
  const campSet = makeCamp(() => campY);
  campGroup.add(campSet.mesh, campSet.flame);
  scene.add(campGroup);
  motes.add({ at: [CAMP[0] + 1.6, campY + 0.6, CAMP[1] + 1.6], spread: [0.3, 0.2, 0.3], n: 36, rise: 2.2, range: 5.5, size: 0.16, color: '#ff9a3a', alpha: 1 });

  // ---- The one sky island: the Rumble glade ----------------------------------------------------
  const floor = (x, z) => Math.min(Math.max((8.1 - Math.hypot(x, z)) * 1.6, 0), 1);
  const glade = makeIsle({ r: 16, depth: 21, seed: 31, pos: GLADE, bump: 0.2, rings: 28, seg: 112, crystals: 8, sand: floor, sandColor: '#2b2740', flats: [[0, 0, 8, 0]] });
  scene.add(glade.group);
  const gladeSet = makeGlade(glade.heightAt);
  glade.group.add(gladeSet.group);
  glade.group.add(makeGrass(glade, low ? 14000 : 28000, 4, (x, z) => Math.hypot(x, z) > 7.9, .9));
  const blossom = makeTree({ seed: 61, height: 6.5, girth: 0.6, leaf: 2.6, depth: 1, spread: 1, palette: ['#7a3f7a', '#f2a6cf', '#ffe0a8'] });
  const blossomGroup = new THREE.Group();
  blossomGroup.position.set(-11, glade.heightAt(-11, -3), -3);
  blossomGroup.add(blossom.wood, blossom.leaves);
  glade.group.add(blossomGroup);
  motes.add({ at: [GLADE[0], GLADE[1] + 1, GLADE[2]], spread: [7, 0.5, 7], n: 140, rise: 0.9, range: 15, size: 0.3, color: '#63f2d4', alpha: 0.9 });
  motes.add({ at: [GLADE[0], GLADE[1] + 1, GLADE[2]], spread: [8, 0.5, 8], n: 50, rise: 0.6, range: 12, size: 0.28, color: '#ffc26b', alpha: 0.9 });
  // a waterfall off its near edge into a pool on the valley floor
  const brink = glade.edge(Math.PI / 2, 0.985), fall = [V3(brink.x, brink.y + 0.15, brink.z - 5), V3(brink.x, brink.y + 0.15, brink.z - 2.5), V3(brink.x, brink.y + 0.12, brink.z)];
  const poolY = H(...POOL) + 0.25;
  for (let k = 1; fall.at(-1).y > poolY; k++) { const t = k * 0.2; fall.push(V3(brink.x, Math.max(brink.y - 4.6 * t * t, poolY), brink.z + 1.4 * t)); }
  scene.add(makeStream(fall, 2, (f) => 0.8 + f * 1.3, 0.9));
  scene.add(makePond(POOL[0], poolY, POOL[1], 5.5));
  motes.add({ at: [POOL[0], poolY + 3, POOL[1]], spread: [3, 3, 3], n: 40, rise: 0.5, range: 5, size: 6, color: '#b8c6ff', alpha: 0.05 });
  // a long root bridge climbs from the valley path up to the island
  const foot = V3(12, H(12, -68) + 0.2, -68), top = glade.edge(Math.atan2(foot.z - GLADE[2], foot.x - GLADE[0]), 0.86);
  top.y += 0.12;
  scene.add(makeBridge(foot, top, 3, 0.03));
  ramps.push(rampOf(foot, top, 0.03));

  const rocks = [];
  [[44, 30, -80, 3], [-6, 26, -84, 2.6], [36, 50, -126, 3.4], [2, 52, -128, 2.4], [52, 20, -58, 2.2], [-22, 14, -64, 2.8]].forEach(([x, y, z, r], i) => {
    const rock = makeIsle({ r, depth: r * 2.1, seed: 50 + i * 3, pos: [x, y, z], seg: 20, rings: 4, bump: 0.2, crystals: 3 });
    scene.add(rock.group);
    if (r > 2.5) rock.group.add(pines([[0, rock.heightAt(0, 0) - 0.1, 0, r * 1.2]], i));
    rocks.push({ g: rock.group, r, y, phase: i * 1.7, amp: 0.25 + (i % 3) * 0.12 });
  });

  // ---- Woods: three tree shapes and one pine, placed by a density map ---------------------------
  const kinds = [
    { tree: makeTree({ seed: 19, height: 9, girth: 0.8, leaf: 2.6, depth: 1, spread: 0.95, palette: ['#12553f', '#5cb663', '#d6e884'] }), crown: [10.5, 5.2], spots: [] },
    { tree: makeTree({ seed: 44, height: 6, girth: 0.5, leaf: 2.1, depth: 1, spread: 0.85, palette: ['#1c5a46', '#8cc46a', '#ffd28a'] }), crown: [7, 4.2], spots: [] },
    { tree: makeTree({ seed: 63, height: 7, girth: 0.6, leaf: 2.4, depth: 1, spread: 1, palette: ['#7a3f7a', '#f2a6cf', '#ffe0a8'] }), crown: [8, 4.6], spots: [] },
  ];
  const pineSpots = [], clear = [[0, 0, 26], [CAFE[0], CAFE[1], 16], [CAMP[0], CAMP[1], 13], [POOL[0], POOL[1], 9], [12, -68, 7]];
  const want = low ? 190 : 470; // a denser wood (was 330)
  for (let tries = 0; kinds[0].spots.length + kinds[1].spots.length + kinds[2].spots.length + pineSpots.length < want && tries < 9000; tries++) {
    const x = (R() * 2 - 1) * 235, z = (R() * 2 - 1) * 235, d = Math.hypot(x, z), h = H(x, z);
    if (d > 240 || h < LAND.water + 1.5 || h > 62) continue;
    if (clear.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)) continue;
    const m = terrain.maskAt(x, z);
    if (m.path > 0.01 || m.sand > 0.2 || m.wet > 0.01) continue;
    const dense = fbm(x * 0.018 + 6, z * 0.018, 3.3, 2) + (z < -45 ? 0.1 : 0) + (d > 140 ? 0.12 : 0);
    if (dense < 0.56 && R() > 0.05) continue;
    const size = 0.8 + R() * 0.6;
    if (h > 26 || R() < 0.3) pineSpots.push([x, h - 0.2, z, 7 + R() * 6]);
    else kinds[R() < 0.1 ? 2 : R() < 0.45 ? 1 : 0].spots.push([x, h - 0.2, z, size]);
  }
  const mat4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler();
  for (const kind of kinds) {
    for (const spots of forestBatches(kind.spots)) {
    const insts = [kind.tree.wood, kind.tree.leaves].map((part) => {
      const inst = new THREE.InstancedMesh(part.geometry, part.material, spots.length);
      spots.forEach(([x, y, z, s], i) => inst.setMatrixAt(i, mat4.compose(V3(x, y, z), quat.setFromEuler(euler.set(0, x * 12.9 + z * 7.3, 0)), V3(s, s, s))));
      inst.computeBoundingSphere();inst.boundingSphere.radius+=FOREST_BATCH.padding;
      scene.add(inst);
      return inst;
    });
    spots.forEach(([x, y, z, s], i) => {
      solids.push([x, z, 0.9 * s, y + kind.crown[0] * s * 0.6]);
      const c=kind.tree.envelope.center.clone().applyAxisAngle(V3(0,1,0),x*12.9+z*7.3).multiplyScalar(s).add(V3(x,y,z));
      canopies.push([c.x,c.y,c.z,kind.tree.envelope.radius*s+.3,{insts,i,x,y,z,s,rotY:x*12.9+z*7.3}]);
    });
    }
  }
  // a bumped tree rocks on its base for a moment
  const shaking = [];
  function shake(ref, power, lean) {
    if (!ref || shaking.some((k) => k.ref === ref && k.age < 0.25)) return;
    shaking.push({ ref, power: Math.min(power, 1.5), lean, age: 0 });
  }
  function rock(dt) {
    for (let k = shaking.length - 1; k >= 0; k--) {
      const it = shaking[k], r = it.ref;
      it.age += dt;
      const done = it.age > 2, a = done ? 0 : it.power * 0.13 * Math.exp(-it.age * 2.6) * Math.sin(it.age * 15);
      if (r.group) r.group.rotation.set(Math.cos(it.lean) * a * 0.4, 0, Math.sin(it.lean) * a * 0.4);
      else {
        quat.setFromEuler(euler.set(Math.cos(it.lean) * a, r.rotY, Math.sin(it.lean) * a, 'XZY'));
        mat4.compose(V3(r.x, r.y, r.z), quat, V3(r.s, r.s, r.s));
        for (const inst of r.insts) { inst.setMatrixAt(r.i, mat4); inst.instanceMatrix.needsUpdate = true; }
      }
      if (done) shaking.splice(k, 1);
    }
  }
  let lastT = 0;
  const pine = pines([[0, 0, 0, 1]], 3);
  for(const spots of forestBatches(pineSpots)){
    const pineInst=new THREE.InstancedMesh(pine.geometry,pine.material,spots.length);
    spots.forEach(([x,y,z,s],index)=>pineInst.setMatrixAt(index,mat4.compose(V3(x,y,z),quat.identity(),V3(s,s,s))));
    pineInst.computeBoundingSphere();pineInst.boundingSphere.radius+=FOREST_BATCH.padding;
    scene.add(pineInst);
  }
  for (const [x, y, z, s] of pineSpots) solids.push([x, z, 0.08 * s + 0.4, y + s * 0.9]);

  // ---- Dressing: lamps, dock, floating lights, camp strings, spires, undergrowth ----
  const treeSpots = [...kinds.flatMap((k) => k.spots), [TREE[0], treeY, TREE[1]]];
  const dress = dressValley({ scene, terrain, LAND, CAFE, CAMP, glade, treeSpots, low, LOFT, TREE, treeTop: treeY + 15 });
  terrain.uniforms.uGarden.value.set(LOFT[0] + 2, LOFT[1] + 3, 19); // flowers always grow around the loft
  ramps.push(...dress.ramps);

  // ---- Bounce pads (giant mushrooms) and wisps -------------------------------------------------
  const padSpots = [[-16, 12], [18, -12], [32, 24], [56, 20], [-40, 22], [-60, -8], [8, -30], [-4, -58], [28, -70], [40, -40], [-30, -70], [100, 60], [8, -84], [36, -96]]
    .map(([x, z]) => V3(x, H(x, z), z));
  const wispSpots = [];
  for (const line of LAND.paths) {
    for (let s = 0; s < line.length - 1; s++) {
      const [ax, az] = line[s], [bx, bz] = line[s + 1], n = Math.round(Math.hypot(bx - ax, bz - az) / 9);
      for (let k = 1; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; wispSpots.push(V3(x, H(x, z) + 2.2, z)); }
    }
  }
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; wispSpots.push(V3(lx + Math.cos(a) * 16, LAND.water + 4 + (k % 2) * 4, lz + Math.sin(a) * 16)); }
  for (let k = 1; k <= 6; k++) wispSpots.push(V3(foot.x + (top.x - foot.x) * k / 7, foot.y + (top.y - foot.y) * k / 7 + 4, foot.z + (top.z - foot.z) * k / 7));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; wispSpots.push(V3(GLADE[0] + Math.cos(a) * 5, GLADE[1] + 4 + k, GLADE[2] + Math.sin(a) * 5)); }
  for (const p of padSpots) wispSpots.push(p.clone().add(V3(0, 15, 0)));
  for (let k = 0; k < 5; k++) wispSpots.push(V3(TREE[0] + Math.cos(k * 1.3) * 9, treeY + 36 + k * 2, TREE[1] + Math.sin(k * 1.3) * 9));

  // ---- Boost hoops: chains that throw a resident from one to the next. The last point is where a chain lands.
  const arc = (ax, az, lift0, bx, by, bz, count, rise) => {
    const a = V3(ax, H(ax, az) + lift0, az), b = V3(bx, by, bz), out = [];
    for (let k = 0; k < count; k++) { const f = k / count; out.push(V3().lerpVectors(a, b, f).add(V3(0, Math.sin(f * Math.PI) * rise, 0))); }
    out.push(b);
    return out;
  };
  const hoopChains = [
    arc(6, -34, 7, GLADE[0], GLADE[1] + 4, GLADE[2] + 6, 5, 6), // valley floor up to the sky island
    arc(58, 46, 6, 114, H(114, 4) + 3, 4, 4, 9), // across the lake
    arc(-14, -4, 7, CAMP[0] + 6, H(CAMP[0] + 6, CAMP[1]) + 3, CAMP[1], 4, 7), // loft knoll to the camp ridge
  ];

  // ---- Lantern pods: strings of balloons to fling through. Each string is a route in the air. ----
  // The lantern pods were dropped 2026-11-17: the owner found them distracting. The code stays; the list is empty.
  const podStrings = [];

  // ---- Air: fireflies, blossoms, smoke -----------------------------------------------------------
  const flowerHues = ['#ffd0e6', '#fff3c4', '#bfe8ff', '#ffb4a0'];
  for (let i = 0; i < 900; i++) {
    const x = (R() * 2 - 1) * 120, z = (R() * 2 - 1) * 120, m = terrain.maskAt(x, z);
    if (m.path + m.sand + m.wet > 0.05 || fbm(x * 0.05, z * 0.05, 8, 2) < 0.48) continue;
    motes.one(x, H(x, z) + 0.7, z, 0.2 + R() * 0.12, flowerHues[i % 4], 0.85);
  }
  motes.add({ at: [0, loftY + 3, 0], spread: [24, 3, 24], n: 110, rise: 0.22, range: 7, size: 0.3, color: '#ffd58a', alpha: 0.9 });
  motes.add({ at: [TREE[0], treeY + 24, TREE[1]], spread: [11, 6, 11], n: 120, rise: 0.15, range: 5, size: 0.26, color: '#fff1b8', alpha: 0.8 });
  motes.add({ at: [lx, LAND.water + 2, lz], spread: [34, 2, 34], n: 160, rise: 0.2, range: 5, size: 0.28, color: '#bfe8ff', alpha: 0.8 });
  motes.add({ at: [CAFE[0], cafeY + 3, CAFE[1]], spread: [10, 3, 10], n: 70, rise: 0.2, range: 6, size: 0.26, color: '#ffc0d8', alpha: 0.8 });
  motes.add({ at: [CAMP[0], campY + 3, CAMP[1]], spread: [11, 3, 11], n: 70, rise: 0.2, range: 6, size: 0.26, color: '#ffd58a', alpha: 0.8 });
  motes.add({ at: [10, 4, -75], spread: [45, 4, 35], n: 220, rise: 0.25, range: 9, size: 0.3, color: '#63f2d4', alpha: 0.8 });
  motes.add({ at: [0, 22, -20], spread: [150, 24, 150], n: 280, rise: 0.3, range: 14, size: 0.42, color: '#ffe2b0', alpha: 0.5 });
  motes.add({ at: [LOFT[0] - 1.5 * LOFT_SCALE, loftY + 12.5, LOFT[1] - 0.6 * LOFT_SCALE], spread: [0.25, 0.3, 0.25], n: 18, rise: 0.7, range: 6, size: 2.6, color: '#8c7aa0', alpha: 0.07 });
  scene.add(motes.build());

  // ---- Lamps the shared lighting reads ---------------------------------------------------------
  const lamp = (i, x, y, z, radius, r, g, b) => { G.uLP.value[i].set(x, y, z, radius); G.uLC.value[i].set(r, g, b); };
  lamp(0, LOFT[0] + 0.6, loftY + 4, LOFT[1] + 6.5, 24, 3.2, 1.5, 0.48);
  lamp(1, CAFE[0], cafeY + 2.4, CAFE[1], 15, 2.3, 1.2, 0.5);
  lamp(3, GLADE[0], GLADE[1] + 2.5, GLADE[2], 20, 0.3, 1.7, 1.25);
  const firePos = [CAMP[0] + 1.6, campY + 1, CAMP[1] + 1.6];

  const view = (x, y, z, dx, dy, dz) => ({ p: [x + dx, y + dy, z + dz], t: [x, y, z] });
  buildVillages(scene,terrain,solids);
  scene.traverse(object => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material?.uniforms?.uOccluder) material.uniforms.uOccluder.value = 1;
    }
  });
  return {
    motes, terrain, terrainProps, woodland,
    /** Camera stops: p = eye, t = look-at. */
    views: {
      all: view(27, 5, 27, -38, 30, 54),
      loft: view(0, loftY + 8, -1, 17, 2, 32),
      cafe: view(CAFE[0] + 4, cafeY + 2, CAFE[1] - 6, -16, 9, 26),
      camp: view(CAMP[0], campY + 3, CAMP[1], 12, 8, 26),
      glade: view(GLADE[0], GLADE[1] + 2.5, GLADE[2], 19, 8.5, 28),
    },
    // what the explore mode collides with
    isles: [glade], rocks, solids, canopies, padSpots, wispSpots, ramps, podStrings,
    lake: { x: lx, z: lz, r: lr * 1.2, y: LAND.water },
    start: { x: 18, z: 22, faceX: 50, faceZ: 52 },
    shake, hoopChains,
    update(t) {
      rock(Math.min(Math.max(t - lastT, 0), 0.1)); lastT = t;
      dress.update(t);
      const flick = 0.82 + 0.18 * Math.sin(t * 11) * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 23);
      lamp(2, ...firePos, 16, 3.2 * flick, 1.35 * flick, 0.36 * flick);
      campSet.flame.scale.set(1.5 + 0.18 * Math.sin(t * 13), 1.3 + 0.45 * flick, 1.5 + 0.18 * Math.cos(t * 9));
      campSet.flame.rotation.y = t * 2;
      gladeSet.shards.rotation.y = t * 0.12;
      gladeSet.shards.position.y = glade.heightAt(0, 0) + Math.sin(t * 0.5) * 0.4;
      for (const r of rocks) { r.g.position.y = r.y + Math.sin(t * 0.35 + r.phase) * r.amp; r.g.rotation.y = Math.sin(t * 0.1 + r.phase) * 0.15; }
    },
  };
}
