// The valley floor: one height function, the ground mesh, and a meadow of grass that follows the camera.
import * as THREE from 'three';
import { shaderMaterial } from './glsl.js';
import { fbm, rng } from './util.js';
import { MEADOW_LOOK } from './terrain-look-data.mjs';
import { parseBlades, meadowSettings } from './mode-model.mjs';

const urlParam = (name) => (typeof location !== 'undefined' ? new URLSearchParams(location.search).get(name) : null); // null under node
import { GROUND_VERT, GROUND_FRAG, MEADOW_VERT, MEADOW_FRAG, lookUniforms } from './terrain-shaders.js';
import { ringTuftGeometry } from './terrain-tuft.mjs';
import { shoreRadius, SHORE } from './shore.mjs';
import { bakeTextures, groundSheets } from './terrain-ground.js';
export { textureSizes } from './terrain-ground.js';

export const LAND = {
  half: 400, // height and mask textures (and the lamp map) cover ±half: past the widest cliff foot (shore.mjs 362 + 12), so the
  // whole island top is mapped. Was 210, when the island ended at 190. Only a texture edge: it lies under the cloud sea everywhere.
  fine: 210, // the fine inner ground sheet is 2 × fine across, unchanged since the island was 420 across
  far: 750, // the coarse outer sheet reaches this far: past the far mountains' full band, out to where the land has sunk (was 430)
  sea: -18, // the cloud sea's height (world.js SEA_Y)
  water: -1.5, // lake surface height
  lake: [85, 25, 30], // x, z, radius
  knoll: [0, 0, 32, 9], // x, z, radius, height: where the loft stands
  ridge: [-78, -28, 30, 13], // camp ridge
  mountainsFrom: 430, // the far ranges rise out of the cloud sea beyond a wide strait (was 255, when the island ended at 190)
  mountainsFull: 560, // and reach full height here (was 320): bigger and further, so they read as distant ranges, not a wall
  sinkFrom: 640, // past the full band the land sinks under the sea by `far` (was 335 to 430)
  sinkDepth: 170, // how far it sinks: deep enough that no peak edge shows at the sheet's rim (unchanged)
  peak: [40, 110], // peak height before the cliff drop: base + span × fbm (fbm sits about 0.3..0.75). Picked so no peak tops a
  // quarter of the screen above the horizon from the loft at 1500×920 and 390×844 (step14 measured; brief 2026-11-18)
  ranges: [3, 2.2, 0.45, 2, 0.6, -0.3, 0.4], // arms, phase, wobble, wobble harmonic, wobble phase, open, full: three ranges of
  // unequal width around the horizon; a direction is open sea where sin(arms·a + phase) + wobble·sin(...) is below `open`.
  // Phase chosen so the loft's view (facing about 0.75 rad) holds one range and one open gap (step14 captures)
  cliffDepth: 48, // the island's edge drops this far, so even a 14-high hill at the lip ends under the cloud sea (-18) by the cliff foot
  mountainLift: 0.3, // share of the cliff drop given back under the far mountains: at 1 the whole ring stood out of the sea as one wall
  // (round 2 capture, 2026-11-18); at 0.3 the low saddles stay under the clouds and the peaks stand apart with open horizon between
  grassLip: [-2, 4], // grass thins out from 2 units before the lip to 4 past it (the lip is SHORE.lipIn inside the shore line)
  cliffTint: [0.05, 0.3], // the ground turns to cliff rock over this share of the drop
  rim: { from: 150, full: 300, lift: 25, hills: 9, freq: 0.008, seed: 12.7 }, // the bowl: from 150 (the valley stays as it was inside)
  // the ground lifts by up to `lift`, full by 300, with wider hills of ±hills on top (period about 125, twice the valley's), so the
  // rim stands 25..35 on median (brief 2026-11-18: "a soft green rim")
  gap: { line: [[130, 27], [400, 45]], core: 16, edge: 130, floor: 3, fade: [150, 175] }, // a low pass east of the lake to the shore
  // for a later river: ground held at `floor` (lake surface + 4.5, the height of the meadow east of the lake at 150) within `core` of
  // the line, blending back to the hills by `edge` (130: the sides fall about 25 over 114 units, gentle enough to stand on where the
  // rim hills add their own slope; 75 and 110 were too steep in places); it starts past 150 and is full by 175, so the valley inside stays as it was
  creek: [[-25, -170], [-40, -110], [-48, -60], [-42, -10], [-15, 40], [30, 52], [58, 38]],
  creekTop: 7, // creek surface height where it leaves the hills
  creekHead: [[-11, -262, 18.8], [-14, -240, 16.4], [-17, -220, 11.3], [-19, -205, 8.6], [-25, -170, 7]], // x, z, surface height: the
  // creek's upper course from a spring on the northern rim down to its old source; heights sit just under the ground found there
  // (step14 probe: 19.2 at r 260, 16.7 at 240, 11.6 at 221, 8 at 205), so the bed is a shallow cut, never a ravine
  creekCut: [10, 2.2, 0.9], // the bed: reaches this far from the line, full depth inside the second, this far under the surface
  headCut: [18, 3], // the upper course's bed reaches wider (the same depth): it runs down a hillside rising about 0.3 a unit, and the
  // valley creek's 10 made banks too steep to stand on there
  creekValley: [70, 0.2, 0.12, 150, 195], // reach, full share, side slope, fade from, fade full: within `reach` of the upper course
  // the ground is lifted to at least its surface plus `side` per unit away. The old source stood 5 above a dip (ground 0 at r 181..191);
  // this fills the dip into a shallow valley. Fades in past 160 so the valley inside 150 is untouched
  haze: [300, 0.35], // from, tail: ground past `from` units from the eye fogs as if only `tail` of the extra distance were there.
  // The valley's fog (glsl.js applyFog) hides anything past about 450 entirely; the far ranges stand 450..650 from the loft, so
  // without this they were gone. Inside 300 (the whole valley seen from the loft) nothing changes. Tuned on the step14 captures.
  rockFrom: [46, 70], // vertex colour turns to rock above this height (was 38..62; the valley never reached 38, the rim hills reach 42)
  paths: [
    [[5, 7], [25, 30], [50, 52], [70, 58]], // loft to cafe
    [[2, 6], [-22, 2], [-44, -16], [-62, -24], [-72, -27]], // loft to camp
    [[6, -8], [6, -42], [12, -68]], // loft to the glade bridge
  ],
};

const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const gauss = (t) => Math.exp(-t * t);

/** Distance from (x,z) to a polyline, and how far along it (0..1). */
function along(line, x, z) {
  let best = Infinity, at = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], dx = bx - ax, dz = bz - az;
    const t = clamp01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; at = (i + t) / (line.length - 1); }
  }
  return [best, at];
}

/** Distance from (x,z) to a polyline of [x, z, y] points, and the y interpolated at the nearest point. */
function alongBed(line, x, z) {
  let best = Infinity, y = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az, ay] = line[i], [bx, bz, by] = line[i + 1], dx = bx - ax, dz = bz - az;
    const t = clamp01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; y = ay + (by - ay) * t; }
  }
  return [best, y];
}

/** The box around a polyline, grown by `pad`: a point outside it is further than `pad` from the line (a cheap early out). */
const boxOf = (line, pad) => [Math.min(...line.map((p) => p[0])) - pad, Math.max(...line.map((p) => p[0])) + pad, Math.min(...line.map((p) => p[1])) - pad, Math.max(...line.map((p) => p[1])) + pad];
const inBox = ([x0, x1, z0, z1], x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const PATH_REACH = 2.4, WET_REACH = 4.2; // a path or creek mask is exactly 0 past these (maskAt below)
const SAND_REACH = 1.62 + 0.125; // lake radii: the sand edge (1.62) plus the most its noise can pull it in (0.25 / 2)
const NORMAL_PROBE = 0.6; // units: normalAt reads the height this far each way

/** The terrain's shape: height, normal, masks. Pure functions of position. flats: [[x, z, radius]] spots levelled for buildings. */
export function terrainShape(flats) {
  const L = LAND, [cut, cutCore, cutDepth] = L.creekCut, R = L.rim, G = L.gap;
  const [vReach, vCore, vSide, ...vFade] = L.creekValley, [headCut, headCore] = L.headCut, headValleyBox = boxOf(L.creekHead, Math.max(vReach, headCut));
  const creekBox = boxOf(L.creek, cut), wetBox = boxOf(L.creek, WET_REACH), headWetBox = boxOf(L.creekHead, WET_REACH);
  const pathBoxes = L.paths.map((line) => boxOf(line, PATH_REACH));
  const [arms, phase, wobble, wobbleK, wobbleP, open, full] = L.ranges;
  /** 0 in the open sea between the far ranges .. 1 along their crests, by direction. */
  const rangeAt = (x, z) => { const a = Math.atan2(z, x); return smooth(open, full, Math.sin(a * arms + phase) + wobble * Math.sin(a * wobbleK + wobbleP)); };
  const rolling = (x, z) => {
    const d = Math.hypot(x, z);
    let h = (fbm(x * 0.012 + 3, z * 0.012, 1.7, 4) - 0.5) * 20 + (fbm(x * 0.045, z * 0.045, 9.1, 3) - 0.5) * 3.5 + 2;
    h += L.knoll[3] * gauss(Math.hypot(x - L.knoll[0], z - L.knoll[1]) / L.knoll[2]);
    h += L.ridge[3] * gauss(Math.hypot(x - L.ridge[0], z - L.ridge[1]) / L.ridge[2]);
    if (d > L.mountainsFrom) { const m = smooth(L.mountainsFrom, L.mountainsFull, d); h += m * m * (L.peak[0] + L.peak[1] * fbm(x * 0.011, z * 0.011, 5.5, 4)) * rangeAt(x, z); }
    if (d > L.sinkFrom) h -= smooth(L.sinkFrom, L.far, d) * L.sinkDepth;
    return h;
  };
  const pads = flats.map(([x, z, r]) => ({ x, z, r, y: rolling(x, z) }));
  const creekY = (t) => L.creekTop + (L.water - L.creekTop) * t;
  /** 0 on the island top .. 1 past the cliff foot: a rounded lip from SHORE.lipIn inside the shore to SHORE.footOut outside it. */
  const islandEdge = (x, z) => { const s = shoreRadius(x, z); return smooth(s - SHORE.lipIn, s + SHORE.footOut, Math.hypot(x, z)); };
  /** 1 where grass may grow, falling to 0 over the lip. */
  const lipGrass = (x, z) => { const lip = shoreRadius(x, z) - SHORE.lipIn; return 1 - smooth(lip + L.grassLip[0], lip + L.grassLip[1], Math.hypot(x, z)); };
  /** Past 150: the bowl's rim lifts the hills (all of it gone again past the cliff, so the sea floor stays deep), then the river gap levels them. */
  const outerHills = (h, x, z, d, e) => {
    h += smooth(R.from, R.full, d) * (R.lift + R.hills * 2 * (fbm(x * R.freq + R.seed, z * R.freq, R.seed, 3) - 0.5)) * (1 - e);
    const [gd] = along(G.line, x, z);
    if (gd < G.edge) h += (G.floor - h) * smooth(G.edge, G.core, gd) * smooth(G.fade[0], G.fade[1], d);
    if (inBox(headValleyBox, x, z)) {
      const [hd, hy] = alongBed(L.creekHead, x, z), lifted = hy + vSide * hd; // the creek's upper course runs in a valley, never on a bank
      if (hd < vReach && lifted > h) h += (lifted - h) * smooth(vReach, vReach * vCore, hd) * smooth(vFade[0], vFade[1], d);
      if (hd < headCut) h += (hy - cutDepth - h) * smooth(headCut, headCore, hd);
    }
    return h;
  };

  const heightAt = (x, z) => {
    let h = rolling(x, z);
    const d = Math.hypot(x, z), e = islandEdge(x, z);
    if (d > R.from) h = outerHills(h, x, z, d, e); // inside 150 the valley is exactly as it was before the island grew
    if (inBox(creekBox, x, z)) { const [cd, ct] = along(L.creek, x, z); if (cd < cut) h += (creekY(ct) - cutDepth - h) * smooth(cut, cutCore, cd); }
    const ld = Math.hypot(x - L.lake[0], z - L.lake[1]) / L.lake[2];
    if (ld < 1.7) { h += (L.water + 1.1 - h) * smooth(1.7, 1.15, ld); h += (L.water - 6 - h) * smooth(1.08, 0.55, ld); }
    for (const p of pads) {
      const pd = Math.hypot(x - p.x, z - p.z);
      if (pd < p.r * 1.8) h += (p.y - h) * smooth(p.r * 1.8, p.r, pd);
    }
    // the island's edge: after the creek, so its bed falls off the cliff with the land; the drop fades out under the far mountains
    if (e > 0) h -= e * L.cliffDepth * (1 - L.mountainLift * smooth(L.mountainsFrom, L.mountainsFull, d));
    return h;
  };
  const normalAt = (x, z, out) => out.set(heightAt(x - NORMAL_PROBE, z) - heightAt(x + NORMAL_PROBE, z), 2 * NORMAL_PROBE, heightAt(x, z - NORMAL_PROBE) - heightAt(x, z + NORMAL_PROBE)).normalize();

  /** 0..1 masks at a point: dirt path, sand (lake shore), creek bed. Each part skips its work where it is exactly 0. */
  const maskAt = (x, z) => {
    let path = 0;
    for (let i = 0; i < L.paths.length; i++) if (inBox(pathBoxes[i], x, z)) path = Math.max(path, 1 - smooth(1.1, PATH_REACH, along(L.paths[i], x, z)[0]));
    const ld = Math.hypot(x - L.lake[0], z - L.lake[1]) / L.lake[2];
    const sand = ld < SAND_REACH ? smooth(1.62, 1.3, ld + (fbm(x * 0.08, z * 0.08, 4, 2) - 0.5) * 0.25) : 0;
    let wet = smooth(1.12, 1.02, ld);
    if (inBox(wetBox, x, z)) wet = Math.max(wet, 1 - smooth(2.4, WET_REACH, along(L.creek, x, z)[0]));
    if (inBox(headWetBox, x, z)) wet = Math.max(wet, 1 - smooth(2.4, WET_REACH, alongBed(L.creekHead, x, z)[0]));
    return { path, sand, wet };
  };
  return { heightAt, normalAt, maskAt, creekY, islandEdge, lipGrass };
}

/** flats: [[x, z, radius]] spots levelled for buildings. */
export function createTerrain(flats, low) {
  const L = LAND, shape = terrainShape(flats), { heightAt, normalAt, maskAt, creekY } = shape;
  const { heightTex, maskTex } = bakeTextures(shape, L, low);
  const shared = {
    uHeightTex: { value: heightTex }, uMaskTex: { value: maskTex }, uHalf: { value: L.half }, uFocus: { value: new THREE.Vector3() },
    uHazeFrom: { value: L.haze[0] }, uHazeTail: { value: L.haze[1] }, // the ground past uHazeFrom fogs as if nearer (terrain-shaders.js GROUND_FRAG)
    ...lookUniforms(), // the look strengths from terrain-look-data.mjs, one uniform each
    uBodies: { value: [0, 1, 2].map(() => new THREE.Vector3(0, -999, 0)) }, // residents: the grass leans away from them
    uPress: { value: urlParam('press') === 'off' ? 0 : 1 }, // `?press=off`: grass does not flatten around residents (to tell that effect from the distance swap)
    uGarden: { value: new THREE.Vector3(0, 0, 0) }, // x, z, radius: a garden where flowers always grow
    uPop: { value: new THREE.Vector4(0, 0, 0, 0) }, uPopPower: { value: 0 }, // a shockwave: centre, current radius, strength
  };

  // ---- Ground: the fine inner sheet, a middle sheet out past the cliff foot, a coarse far sheet for the far ranges (terrain-ground.js) ----
  const groundMat = shaderMaterial(GROUND_VERT, GROUND_FRAG, shared);
  const group = new THREE.Group();
  for (const mesh of groundSheets(shape, L, low, groundMat)) group.add(mesh);

  // ---- Meadow: blades live in one square tile that wraps around the focus point ----
  const set = meadowSettings(low), TILE = set.tile, COUNT = parseBlades(urlParam('blades')) ?? set.count;
  // `?swap=off`: every blade switches at the far end of the band, so nothing changes size nearer than that (a diagnostic: the far edge pops instead)
  if (urlParam('swap') === 'off') shared.uSwitchFrom.value = TILE / 2 - MEADOW_LOOK.switchMargin - MEADOW_LOOK.switchSink;
  shared.uGustDetail.value = set.gustDetail; shared.uStreakDetail.value = set.streakDetail; // phone: one noise octave
  const blade = new THREE.BufferGeometry(), w = set.width;
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, -w * 0.9, 0.45, 0, w * 0.9, 0.45, 0, -w * 0.72, 0.8, 0, w * 0.72, 0.8, 0, -w * 0.36, 0.97, 0, w * 0.36, 0.97, 0], 3)); // a rounded tip
  blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6, 6, 5, 7]);
  const meadow = new THREE.InstancedMesh(blade, shaderMaterial(MEADOW_VERT, MEADOW_FRAG, { ...shared, uTile: { value: TILE }, uRing: { value: 0 } }, { side: THREE.DoubleSide }), COUNT); // uRing is stated: the ring shares this GL program, and an unset uniform keeps the ring's 1
  const R = rng(17), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    q.setFromEuler(e.set((R() - 0.5) * 0.35, R() * Math.PI, (R() - 0.5) * 0.35));
    meadow.setMatrixAt(i, m.compose(v.set(R() * TILE, 0, R() * TILE), q, s.set(1 + R() * 0.8, MEADOW_LOOK.heightMin + R() * MEADOW_LOOK.heightSpan, 1)));
  }
  meadow.frustumCulled = false;
  group.add(meadow);

  // ---- Coarse ring: three low leaves at each seat in a wider tile ----
  // `?ring=off` removes the ring and the far-ground streaks, for before/after captures and benches.
  const ringOff = urlParam('ring') === 'off';
  const RTILE = MEADOW_LOOK.ringTile, RCOUNT = ringOff ? 0 : set.ringCount;
  const ringUniforms = { ...shared, uTile: { value: RTILE }, uRing: { value: 1 }, uFarFrom: { value: MEADOW_LOOK.ringFarFrom }, uFlower: { value: 0 } };
  const tuft = new THREE.BufferGeometry(), tuftData = ringTuftGeometry(w);
  tuft.setAttribute('position', new THREE.Float32BufferAttribute(tuftData.positions, 3));
  tuft.setIndex(tuftData.indices);
  const ring = new THREE.InstancedMesh(tuft, shaderMaterial(MEADOW_VERT, MEADOW_FRAG, ringUniforms, { side: THREE.DoubleSide }), Math.max(RCOUNT, 1));
  const RR = rng(23);
  for (let i = 0; i < RCOUNT; i++) {
    q.setFromEuler(e.set((RR() - 0.5) * 0.35, RR() * Math.PI, (RR() - 0.5) * 0.35));
    ring.setMatrixAt(i, m.compose(v.set(RR() * RTILE, 0, RR() * RTILE), q, s.set((1 + RR() * 0.8) * MEADOW_LOOK.ringWidth, (MEADOW_LOOK.heightMin + RR() * MEADOW_LOOK.heightSpan) * MEADOW_LOOK.ringHeight, 1)));
  }
  ring.count = RCOUNT; ring.frustumCulled = false;
  meadow.add(ring); // a child, so hiding the meadow (shadow pass, bench `off=grass`) hides the ring too
  if (ringOff) shared.uStreak.value = 0;

  // ---- Flowers: the same wrapping trick, with a bloom on each stem, growing in drifts of one colour ----
  const FLOWERS = low ? 3500 : 8000, bloom = new THREE.BufferGeometry(), sw = 0.022, hw = 0.1; // the head is as tall as it is wide: a dot, not a dart // fewer and smaller: dots of colour, not confetti
  bloom.setAttribute('position', new THREE.Float32BufferAttribute([-sw, 0, 0, sw, 0, 0, -sw, 0.8, 0, sw, 0.8, 0, -hw, 0.88, 0, hw, 0.88, 0, 0, 0.88 + hw, 0, 0, 0.88 - hw, 0], 3));
  bloom.setIndex([0, 1, 2, 2, 1, 3, 7, 5, 6, 7, 6, 4]);
  const flowers = new THREE.InstancedMesh(bloom, shaderMaterial(MEADOW_VERT, MEADOW_FRAG, { ...shared, uTile: { value: TILE }, uFlower: { value: 1 }, uRing: { value: 0 } }, { side: THREE.DoubleSide }), FLOWERS);
  meadow.material.uniforms.uFlower = { value: 0 };
  for (let i = 0; i < FLOWERS; i++) {
    q.setFromEuler(e.set((R() - 0.5) * 0.3, R() * Math.PI, (R() - 0.5) * 0.3));
    const fs = 0.7 + R() * 0.5;
    flowers.setMatrixAt(i, m.compose(v.set(R() * TILE, 0, R() * TILE), q, s.set(fs, fs, 1)));
  }
  flowers.frustumCulled = false;
  meadow.userData.part = 'grass'; flowers.userData.part = 'flowers'; // bench part names
  group.add(flowers);

  /** The tuner's blade thinning: draw this share of the fine and coarse blades (they sit in random places, so any prefix is an even thinning). */
  const thinTo = (share) => { meadow.count = Math.floor(COUNT * share); ring.count = Math.floor(RCOUNT * share); };

  return { group, heightAt, normalAt, maskAt, creekY, thinTo, meadow, uniforms: shared, focus: shared.uFocus.value, bodies: shared.uBodies.value };
}
