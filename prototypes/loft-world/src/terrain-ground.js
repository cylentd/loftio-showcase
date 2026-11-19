// The ground's GPU side: the height and mask textures over the island, and three nested ground sheets (fine, middle, far).
// Behaviour only; shapes come from terrain.js (heightAt, maskAt), sizes are named here.
import * as THREE from 'three';
import { fbm } from './util.js';

/** Texture sizes, [desktop, phone]. Texel sizes before the island grew (±210 covered): mask 420/1024 = 0.41 units desktop and
 * 420/512 = 0.82 phone, height 420/512 = 0.82. Over ±400 these sizes keep every texel as small or smaller:
 * mask 800/2048 = 0.39 and 800/1024 = 0.78, height 800/1024 = 0.78 desktop; the phone height texel grows to 1.56
 * (grass roots only; the shortest hill wave is about 22 units, so 1.56 still follows it). */
export const TEXTURES = { height: [1024, 512], mask: [2048, 1024] };
export const textureSizes = (low) => ({ height: TEXTURES.height[low ? 1 : 0], mask: TEXTURES.mask[low ? 1 : 0] });

/** Ground sheets. The fine sheet keeps its 300 (phone 200) segments over 2 × LAND.fine. The middle sheet is built on every
 * `midStep`-th line of the fine grid (2.8 units a quad desktop, 4.2 phone; the brief asked about 3), so the two share their
 * vertices along the fine sheet's edge. Seen from above, the cliff's vertex colour smears down its drop in green teeth
 * (step14 glide-noon-r1.png); midStep 1 only shrank them and cost 500k triangles (glide-noon-r2.png), so the fix is a
 * per-pixel cliff tint, not more vertices. The middle sheet skips the quads the fine sheet covers but one ring, which it dips `midDip` under
 * the fine sheet to cover the T-joins. The far sheet joins the middle one as the old outer ring joined the fine one: dropped
 * `farDrop` under it inside `farOverlap` of its edge. farSeg: about 8 units a quad desktop, 12.5 phone, for the far ranges. */
export const SHEETS = { fineSeg: [300, 200], midStep: 2, midDip: 1, farSeg: [190, 120], farDrop: 3, farOverlap: 8, seam: 0.01 };

const GRASS = new THREE.Color('#49775d'), GRASS2 = new THREE.Color('#759575'), ROCK = new THREE.Color('#394a60'), ROCK2 = new THREE.Color('#56677c'), SNOW = new THREE.Color('#c4d1dd');
const CLIFF = new THREE.Color('#57536b'), CLIFF2 = new THREE.Color('#7a7290'); // grey-violet, between the far mountains' blue rock and the dusk haze
const SLOPE_PROBE = 1.5; // units: the slope behind the rock colour is read this far away
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const box = (x, z) => Math.max(Math.abs(x), Math.abs(z));

/** Height (one half-float channel) and mask (path, sand, wet, grass) textures over ±L.half. */
export function bakeTextures(shape, L, low) {
  const { height: HS, mask: MS } = textureSizes(low), heights = new Uint16Array(HS * HS);
  for (let j = 0; j < HS; j++) for (let i = 0; i < HS; i++) {
    heights[j * HS + i] = THREE.DataUtils.toHalfFloat(shape.heightAt((i / (HS - 1) * 2 - 1) * L.half, (j / (HS - 1) * 2 - 1) * L.half));
  }
  const heightTex = new THREE.DataTexture(heights, HS, HS, THREE.RedFormat, THREE.HalfFloatType);
  const masks = new Uint8Array(MS * MS * 4);
  for (let j = 0; j < MS; j++) for (let i = 0; i < MS; i++) {
    const x = (i / (MS - 1) * 2 - 1) * L.half, z = (j / (MS - 1) * 2 - 1) * L.half, k = (j * MS + i) * 4, m = shape.maskAt(x, z);
    masks[k] = m.path * 255; masks[k + 1] = m.sand * 255; masks[k + 2] = m.wet * 255;
    masks[k + 3] = (1 - Math.max(m.path, m.sand, m.wet)) * shape.lipGrass(x, z) * 255; // where grass grows: not past the cliff lip
  }
  const maskTex = new THREE.DataTexture(masks, MS, MS, THREE.RGBAFormat, THREE.UnsignedByteType);
  for (const tex of [heightTex, maskTex]) { tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true; }
  return { heightTex, maskTex };
}

/** The vertex colour of the ground at (x, z), height h. */
function groundColour(shape, L, x, z, h, c, c2) {
  const slope = 1 - (shape.heightAt(x + SLOPE_PROBE, z) - h) ** 2 / SLOPE_PROBE ** 2 - (shape.heightAt(x, z + SLOPE_PROBE) - h) ** 2 / SLOPE_PROBE ** 2;
  c.copy(GRASS).lerp(GRASS2, fbm(x * 0.03, z * 0.03, 2, 3));
  const rocky = Math.max(smooth(0.72, 0.4, slope), smooth(L.rockFrom[0], L.rockFrom[1], h));
  c.lerp(c2.copy(ROCK).lerp(ROCK2, fbm(x * 0.05, h * 0.2, z * 0.05, 2)), rocky);
  const cliff = smooth(L.cliffTint[0], L.cliffTint[1], shape.islandEdge(x, z)) * (1 - smooth(L.mountainsFrom, L.mountainsFull, Math.hypot(x, z)));
  if (cliff > 0) c.lerp(c2.copy(CLIFF).lerp(CLIFF2, fbm(x * 0.07, h * 0.25, z * 0.07, 2)), cliff); // the island's cliff face: grey-violet rock, banded by height
  c.lerp(SNOW, smooth(78, 100, h + fbm(x * 0.04, z * 0.04, 7, 2) * 20));
  return c;
}

/** A square sheet `half` across each way. cull(corners): leave out a triangle, given its three [x, z] corners. dip(x, z): how far
 * under the true height a vertex sits. analytic: normals from the height function instead of the faces (for a sheet's edge). */
function sheet(shape, L, half, seg, { cull = null, dip = () => 0, analytic = () => false } = {}) {
  const g = new THREE.PlaneGeometry(half * 2, half * 2, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), c2 = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = shape.heightAt(x, z);
    p.setY(i, h - dip(x, z));
    groundColour(shape, L, x, z, h, c, c2).toArray(col, i * 3);
  }
  if (cull) {
    const index = g.index.array, kept = [], at = (v) => [p.getX(v), p.getZ(v)];
    for (let t = 0; t < index.length; t += 3) if (!cull([at(index[t]), at(index[t + 1]), at(index[t + 2])])) kept.push(index[t], index[t + 1], index[t + 2]);
    g.setIndex(kept);
  }
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) if (analytic(p.getX(i), p.getZ(i))) n.setXYZ(i, ...shape.normalAt(p.getX(i), p.getZ(i), v).toArray());
  return g;
}

/** The three ground sheets, fine to far, as meshes sharing one material. */
export function groundSheets(shape, L, low, material) {
  const fineSeg = SHEETS.fineSeg[low ? 1 : 0], step = (2 * L.fine / fineSeg) * SHEETS.midStep;
  const midHalf = L.fine + Math.ceil((L.half - L.fine) / step) * step, midSeg = Math.round(2 * midHalf / step);
  const farSeg = SHEETS.farSeg[low ? 1 : 0], farStep = 2 * L.far / farSeg, farIn = midHalf - SHEETS.farOverlap;
  const all = (test) => (corners) => corners.every(([x, z]) => test(x, z)), any = (test) => (corners) => corners.some(([x, z]) => test(x, z));
  // the middle sheet is cut round at midHalf, so its join with the far sheet is a circle under the cloud sea (the cliff foot is
  // at most 374 out, the far ranges start at 430); a square edge ran its corners through the far ranges
  const underFine = all((x, z) => box(x, z) < L.fine - step + SHEETS.seam), pastMid = any((x, z) => Math.hypot(x, z) > midHalf);
  const geometries = [
    // the fine sheet as it always was; only its edge row, now out in the open, takes normals from the height function
    sheet(shape, L, L.fine, fineSeg, { analytic: (x, z) => box(x, z) > L.fine - SHEETS.seam }),
    sheet(shape, L, midHalf, midSeg, { cull: (c) => underFine(c) || pastMid(c), dip: (x, z) => (box(x, z) < L.fine - SHEETS.seam ? SHEETS.midDip : 0), analytic: () => true }),
    sheet(shape, L, L.far, farSeg, { cull: all((x, z) => Math.hypot(x, z) < farIn - farStep * 2), dip: (x, z) => (Math.hypot(x, z) < farIn ? SHEETS.farDrop : 0) }),
  ];
  return geometries.map((g) => new THREE.Mesh(g, material));
}
