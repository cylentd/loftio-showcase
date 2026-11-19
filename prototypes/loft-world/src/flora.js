// Trees grown from a seed, pines, glow mushrooms, and wind-blown grass.
import * as THREE from 'three';
import { COMMON, NOISE, shaderMaterial, softMaterial } from './glsl.js';
import { GLADE_GRASS_LOOK } from './terrain-look-data.mjs';
import { V3, blob, merge, place, rng, tint, tube } from './util.js';

import {leafGeometry} from './woodland-view.js';
import { BLOB_TRIANGLES, CROWN_DEBUG_PARAM, CROWN_MESH_OLD, CROWN_MESH_PARAM, CROWN_RIM, CROWN_SOFT_NORMAL, MIN_BLEND_WEIGHT } from './tree-variety-data.mjs';
import { CROWN_MESH_MERGED, CROWN_SOFT_NORMAL_FACETS, FACET_CLUMP_TONE, FACET_HEIGHT_TONE, FACET_RIM_SHARE, FACET_WARM_MIX, FACET_WARM_SHARE, FACET_WOOD_DARK, FACET_WOOD_RANGE, PINE_COLORS } from './tree-facets-data.mjs';
import { buildFacetTree } from './tree-facets.mjs';
import { buildClayTree } from './tree-clay.mjs';
import { CHERRY_LOOK, CLAY_LEAVES, CLAY_LIGHT_FLOOR, CROWN_MESH_CLAY, LEAVES_OFF, LEAVES_PARAM } from './tree-clay-data.mjs';
import { extractCrown } from './crown-mesh.mjs';
const BARK = '#5a4936';

/** Lines of glsl.js's soft shader that the blossom speckle hooks onto; a missing one throws, so a shader change fails loudly. */
const HOOK_VERT = 'vP=wp.xyz;', HOOK_FRAG = 'float ndv=clamp(dot(n,v),0.,1.);';
/** The line after all lighting (glow mix): the cherry's warm lift goes just before it, on the lit colour c. */
const HOOK_LIT = 'c=mix(c,vCol*uGlow*uFlicker,vGlow);';
const glslVec = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(',')})`, glslF = (x) => x.toFixed(3);

/** Fine flower speckle near the camera: a cellular noise in object space (one jittered point per cell, 2x2x2 nearest
 * search) whose points become near-white petal blobs, some with a deep pink centre. Fades out between look.near and look.far. */
function blossomChunk(k) {
  return `{
  float bloom=1.-smoothstep(${glslF(k.near)},${glslF(k.far)},distance(cameraPosition,vP));
  if(bloom>0.){
    vec3 q=vObj/${glslF(k.cell)}, id=floor(q), f=fract(q), side=step(.5,f)-1.;
    float d=9., pick=0.;
    for(int i=0;i<8;i++){
      float fi=float(i); vec3 o=side+vec3(mod(fi,2.),mod(floor(fi*.5),2.),floor(fi*.25));
      vec3 h=fract(sin(vec3(dot(id+o,vec3(127.1,311.7,74.7)),dot(id+o,vec3(269.5,183.3,246.1)),dot(id+o,vec3(113.5,271.9,124.6))))*43758.5453);
      float e=length(o+h-f); if(e<d){d=e;pick=h.x*.5+h.y*.5;}
    }
    float lum=max(alb.r,max(alb.g,alb.b));
    float petal=1.-smoothstep(${glslF(k.petal[0])},${glslF(k.petal[1])},d), dot1=(1.-smoothstep(${glslF(k.dot[0])},${glslF(k.dot[1])},d))*step(${glslF(1 - k.dotShare)},pick);
    alb=mix(alb,${glslVec(k.petalColour)}*lum,petal*${glslF(k.petalMix)}*bloom);
    alb=mix(alb,${glslVec(k.dotColour)}*lum,dot1*${glslF(k.dotMix)}*bloom);
  }
}
`;
}

/** Line of the soft vertex shader that the leaf hook replaces: leaves move in object space, before instancing. */
const HOOK_LEAF = 'vec4 wp=vec4(position,1.);';

/** Leaf vertices (aLeafBase set; zero on puffs and wood) fold onto their base with camera distance, full inside k.NEAR and
 * gone by k.FAR, and flutter at the tip with a phase hashed from the base. Puff vertices never move. */
function leafChunk(k) {
  return `vec3 lp=position;
  if(dot(aLeafBase,aLeafBase)>0.){
    vec4 lb=vec4(aLeafBase,1.);
    #ifdef USE_INSTANCING
      lb=instanceMatrix*lb;
    #endif
    lb=modelMatrix*lb;
    float keep=1.-smoothstep(${glslF(k.NEAR)},${glslF(k.FAR)},distance(cameraPosition,lb.xyz));
    vec3 off=position-aLeafBase;
    float tip=clamp(length(off)/${glslF(k.LEN[1])},0.,1.), ph=fract(sin(dot(aLeafBase,vec3(12.9898,78.233,37.719)))*43758.5453)*6.2832;
    float s=uTime*${glslF(k.FLUTTER_SPEED)}+ph;
    off+=vec3(sin(s),.5*sin(s*1.37+1.),cos(s*.83))*${glslF(k.FLUTTER)}*tip*uWind;
    lp=aLeafBase+off*keep;
  }
  vec4 wp=vec4(lp,1.);`;
}

/** The soft crown material with leaf folding and flutter (kinds whose recipe has leaves; the rest keep glsl.js's shader). */
function leafed(mat) {
  if (!mat.vertexShader.includes(HOOK_LEAF)) throw new Error('leaves: soft shader hook moved (glsl.js)');
  mat.vertexShader = 'attribute vec3 aLeafBase;\n' + mat.vertexShader.replace(HOOK_LEAF, leafChunk(CLAY_LEAVES));
  return mat;
}

/** `?leaves=off` builds the old smooth crowns, for before and after captures. */
const leavesOn = () => typeof location === 'undefined' || new URLSearchParams(location.search).get(LEAVES_PARAM) !== LEAVES_OFF;

const CAPTURE_PARAM = 'capture'; // the switch main.js reads before it publishes __treeDebug
/** Measurement hook, read by the QA scripts: total ms and one entry per crown. Only a `?capture` run keeps it, like __treeDebug. */
function recordCrown(startedAt, entry) {
  if (typeof location === 'undefined' || !new URLSearchParams(location.search).has(CAPTURE_PARAM)) return;
  const stats = (globalThis.__crownStats ||= { ms: 0, kinds: [] });
  stats.ms += performance.now() - startedAt; stats.kinds.push(entry);
}

/** The soft crown material with the blossom speckle added (cherry only; every other kind keeps glsl.js's shader as is). */
function blossomed(mat, look) {
  if (!mat.vertexShader.includes(HOOK_VERT) || !mat.fragmentShader.includes(HOOK_FRAG) || !mat.fragmentShader.includes(HOOK_LIT)) throw new Error('blossom: soft shader hooks moved (glsl.js)');
  mat.vertexShader = 'varying vec3 vObj;\n' + mat.vertexShader.replace(HOOK_VERT, `${HOOK_VERT} vObj=position;`);
  mat.fragmentShader = 'varying vec3 vObj;\n' + mat.fragmentShader.replace(HOOK_FRAG, blossomChunk(look) + HOOK_FRAG).replace(HOOK_LIT, warmChunk(look) + HOOK_LIT);
  return mat;
}

/** Keeps the lit crown pink under the blue dusk ambient: red moves toward the brightest channel by look.warm, and blue is
 * capped at look.blueCap of red; red alone gains look.redGain (8%), far below bloom-bright values. */
function warmChunk(k) {
  return `{ float dusk=1.-smoothstep(${glslF(k.duskSun[0])},${glslF(k.duskSun[1])},normalize(uSun).y), hi=max(c.r,max(c.g,c.b));
  c.r=mix(c.r,mix(c.r,hi,${glslF(k.warm)})*${glslF(k.redGain)},dusk); c.b=min(c.b,c.r*mix(1.,${glslF(k.blueCap)},dusk)); }\n`;
}

/** Crown shading strengths; `?crown=0` in the URL forces them to 0 (the old look) for before/after captures. */
function crownLook() {
  const off = typeof location !== 'undefined' && new URLSearchParams(location.search).get(CROWN_DEBUG_PARAM) === '0';
  return { crownSoft: off ? 0 : CROWN_SOFT_NORMAL, crownRim: off ? 0 : CROWN_RIM };
}

/** `?crowns=` picks the crown build: 'clay' (default), 'facets', 'merged' (one smooth surface) or 'blobs' (the old separate balls). */
function crownMode() {
  const v = typeof location !== 'undefined' ? new URLSearchParams(location.search).get(CROWN_MESH_PARAM) : null;
  return v === CROWN_MESH_OLD ? 'blobs' : v === CROWN_MESH_MERGED ? 'merged' : v === 'facets' ? 'facets' : CROWN_MESH_CLAY;
}
const useMergedCrowns = () => crownMode() !== 'blobs';

/** Mesh geometry from a pure facet mesh; colour(c, i) fills vertex i's colour. */
function facetGeometry(m, colour) {
  const n = m.positions.length / 3, cols = new Float32Array(n * 3), c = new THREE.Color(), g = new THREE.BufferGeometry();
  for (let i = 0; i < n; i++) { colour(c, i); cols.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(cols, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (m.index) g.setIndex(new THREE.BufferAttribute(m.index, 1));
  return g;
}

const smoothstep = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

/** Crown and wood geometries of one faceted tree, coloured from the palette: facet tone picks dark..light, some clumps lean to the accent.
 * look (optional, CHERRY_LOOK): upward faces lerp to the accent and the baked light keeps a higher floor. barkHex: wood colour. */
function facetParts(t, palette, seed, look = null, barkHex = BARK) {
  const R = rng(seed), [dark, light, accent] = palette.map((p) => new THREE.Color(p)), warm = [], mix = [], floor = look ? look.lightFloor : CLAY_LIGHT_FLOOR;
  for (let i = 0; i < t.clumps.length; i++) { warm.push(R() < FACET_WARM_SHARE); mix.push((R() - 0.5) * FACET_CLUMP_TONE); }
  const crown = facetGeometry(t.crown, (c, i) => {
    const y = t.crown.positions[i * 3 + 1] / t.height, k = Math.min(Math.max(t.crown.tone[i] + mix[t.crown.part[i]] + (y - 0.5) * FACET_HEIGHT_TONE, 0), 1);
    c.copy(dark).lerp(light, k);
    if (warm[t.crown.part[i]]) c.lerp(accent, FACET_WARM_MIX * k);
    if (look) c.lerp(accent, look.topWhite * smoothstep(look.topFrom, look.topTo, t.crown.normals[i * 3 + 1]));
    if (t.crown.light) c.multiplyScalar(floor + (1 - floor) * t.crown.light[i]);
  });
  const bark = new THREE.Color(barkHex);
  const wood = facetGeometry(t.wood, (c, i) => { c.copy(bark).multiplyScalar(FACET_WOOD_DARK + t.wood.tone[i] * FACET_WOOD_RANGE * Math.min(t.wood.positions[i * 3 + 1] / (t.height * 0.5), 1)); if (t.wood.light) c.multiplyScalar(CLAY_LIGHT_FLOOR + (1 - CLAY_LIGHT_FLOOR) * t.wood.light[i]); });
  return { crown, wood };
}

/** A faceted tree in the shape makeTree returns, plus `trunk` ({radius, top}) for colliders. Branches belong to the wood mesh. */
function makeFacetTree(o) {
  const look = o.blossom ? CHERRY_LOOK : null;
  const t0 = performance.now(), t = (crownMode() === CROWN_MESH_CLAY ? buildClayTree : buildFacetTree)({ ...o, leaves: leavesOn() }), { crown, wood } = facetParts(t, o.palette, o.seed, look, o.bark);
  if (t.leaves) crown.setAttribute('aLeafBase', new THREE.BufferAttribute(t.crown.leafBase, 3));
  const mid = new THREE.Vector3(...t.envelope.center);
  if (!t.crown.light) shadeCanopy(crown, mid, t.envelope.radius); // clay crowns carry their own baked light
  recordCrown(t0, { archetype: o.archetype, triangles: t.triangles, radius: t.envelope.radius, leaves: t.leaves || 0 });
  const soft = CROWN_SOFT_NORMAL_FACETS, leafMat = softMaterial({ sway: 1, leaf: 0, crown: mid, crownSoft: crownLook().crownSoft ? soft : 0, crownRim: crownLook().crownRim * FACET_RIM_SHARE });
  return {
    wood: new THREE.Mesh(wood, softMaterial()),
    leaves: new THREE.Mesh(crown, look ? blossomed(leafMat, look) : t.leaves ? leafed(leafMat) : leafMat),
    tips: t.tips.map((p) => V3(...p)), envelope: { center: mid.clone(), radius: t.envelope.radius }, trunk: t.trunk,
  };
}

/** Darker deep inside and underneath a crown, brighter on the outer top (crown centre `mid`, radius `rad`). */
function shadeCanopy(geo, mid, rad) {
  const lp = geo.attributes.position, lc = geo.attributes.aCol;
  for (let i = 0; i < lp.count; i++) {
    const dx = lp.getX(i) - mid.x, dy = lp.getY(i) - mid.y, dz = lp.getZ(i) - mid.z;
    const out = Math.min(Math.hypot(dx, dy, dz) / rad, 1), k = (0.45 + 0.75 * out * out) * (0.8 + 0.35 * Math.min(Math.max(dy / rad + 0.5, 0), 1));
    lc.setXYZ(i, lc.getX(i) * k, lc.getY(i) * k, lc.getZ(i) * k);
  }
}

/** One continuous crown surface for a tree's blobs; each vertex takes its colour from the blobs by the smooth union's weights. */
function mergedCrown(blobs, budget) {
  const t0 = performance.now();
  const m = extractCrown(blobs, { maxTriangles: budget }), n = m.positions.length / 3, cols = new Float32Array(n * 3), c = new THREE.Color(), acc = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const y = m.positions[i * 3 + 1];
    acc.setRGB(0, 0, 0);
    for (const [j, w] of m.shares[i]) {
      if (w < MIN_BLEND_WEIGHT) continue;
      const b = blobs[j], ly = Math.min(Math.max((y - b.c[1]) / b.r[1], -1), 1);
      b.color(c, ly);
      acc.r += c.r * w; acc.g += c.g * w; acc.b += c.b * w;
    }
    cols.set([acc.r, acc.g, acc.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(cols, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  recordCrown(t0, { before: budget / BLOB_TRIANGLES * BLOB_TRIANGLES, after: m.triangleCount });
  return g;
}

/**
 * o: { seed, height, girth, leaf (puff size), depth (branch levels), spread, palette:[dark, light, accent] }
 * Returns { wood, leaves, tips } where tips are branch-end points (for lanterns), all in tree-local coords.
 */
export function makeTree(o) {
  if (o.archetype && (crownMode() === 'facets' || crownMode() === CROWN_MESH_CLAY)) return makeFacetTree(o);
  const R = rng(o.seed), wood = [], puffs = [], tips = [];
  const dark = new THREE.Color(o.palette[0]), light = new THREE.Color(o.palette[1]), accent = new THREE.Color(o.palette[2]);

  const blobs = []; // every crown blob as an ellipsoid, for the merged crown surface
  const lift = (u) => Math.min(Math.max(u, 0), 1);
  function puff(p, size) {
    // A soft full core gives the crown its mass; leaves standing off its surface give it a leafy edge.
    const core = blob(o.seed + puffs.length * 1.37, 0.055, 1.4, 3), warm = R() < 0.22, mix = R();
    const coreColor = (c, y) => {
      c.copy(dark).lerp(light, lift(y * 0.6 + 0.45 + mix * 0.2));
      if (warm) c.lerp(accent, 0.35 * Math.max(y, 0));
    };
    const yaw = R() * 6, sx = size * 1.15, sy = size * (0.72 + R() * 0.14), sz = size * (0.95 + R() * 0.2);
    blobs.push({ c: [p.x, p.y, p.z], r: [sx, sy, sz], yaw, color: coreColor });
    puffs.push(place(tint(core, '#ffffff', 0, (c, _x, y) => coreColor(c, y)), p.x, p.y, p.z, 0, yaw, 0, sx, sy, sz));
    // small round poms on the surface break up the outline. Nothing pointed: this is a soft toy of a tree.
    for (let i = 0; i < 2; i++) {
      const a = R() * Math.PI * 2, up = R() * 1.5 - 0.4, ring = Math.sqrt(Math.max(1 - Math.min(up, 1) ** 2, 0.05)), pom = size * (0.26 + R() * 0.16);
      const c = dark.clone().lerp(light, 0.4 + Math.max(up, 0) * 0.45 + R() * 0.15);
      if (i % 4 === 0) c.lerp(accent, 0.35);
      const px = p.x + Math.cos(a) * ring * size * 0.66, py = p.y + up * size * 0.46, pz = p.z + Math.sin(a) * ring * size * 0.66, pyaw = R() * 6;
      const pomColor = (cc, y) => cc.copy(c).multiplyScalar(0.8 + 0.2 * (y + 1) / 2);
      blobs.push({ c: [px, py, pz], r: [pom, pom * 0.85, pom], yaw: pyaw, color: pomColor });
      puffs.push(place(tint(blob(o.seed + i * 2.1 + puffs.length, 0.04, 1.4, 2), c, 0, (cc, _x, y) => pomColor(cc, y)), px, py, pz, 0, pyaw, 0, pom, pom * 0.85, pom));
    }
  }

  function branch(start, dir, len, rad, depth) {
    const N = depth ? 5 : 7, pts = [], rads = [];
    const p = start.clone(), d = dir.clone();
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      pts.push(p.clone());
      const r = rad * (1 - f * 0.55);
      if (depth === 0) {
        const flare = 1 + 1.7 * Math.exp(-i * 1.1), lobes = 0.28 * Math.exp(-i * 0.9);
        rads.push((a) => r * flare * (1 + lobes * Math.sin(a * 5 + 1)));
      } else rads.push(r);
      if (i === N) break;
      d.add(V3((R() - 0.5) * o.spread * 0.5, depth ? 0.16 : 0.03, (R() - 0.5) * o.spread * 0.5)).normalize();
      p.addScaledVector(d, len / N);
      const forks = depth === 0 ? (f > 0.42 ? 2 : 0) : depth < o.depth && i >= 2 ? 1 : 0;
      for (let k = 0; k < forks; k++) {
        const ang = R() * Math.PI * 2;
        const nd = d.clone().multiplyScalar(0.55).add(V3(Math.cos(ang), 0.42 + R() * 0.3, Math.sin(ang)).multiplyScalar(o.spread)).normalize();
        branch(p.clone(), nd, len * (0.5 + R() * 0.22), r * 0.58, depth + 1);
      }
    }
    wood.push(tube(pts, rads, depth ? 6 : 14));
    const cluster = (n, reach, size) => {
      for (let k = 0; k < n; k++) puff(p.clone().add(V3((R() - 0.5) * reach, (R() - 0.3) * reach * 0.6, (R() - 0.5) * reach)), size * (0.6 + R() * 0.55));
    };
    if (depth >= 1) {
      tips.push(p.clone());
      puff(p, o.leaf * (0.8 + R() * 0.4));
      cluster(1, o.leaf * 1.2, o.leaf);
    } else {
      puff(p.clone().add(V3(0, o.leaf * 0.3, 0)), o.leaf * 1.2);
      cluster(2, o.leaf * 1.6, o.leaf);
    }
  }
  branch(V3(), V3(0, 1, 0), o.height, o.girth, 0);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;wood.push(tube([V3(0,o.girth,0),V3(Math.cos(a)*o.girth*1.7,.25,Math.sin(a)*o.girth*1.7),V3(Math.cos(a)*o.girth*3,0,Math.sin(a)*o.girth*3)],[o.girth*.45,o.girth*.24,.03],6));}

  // Shade the canopy as one mass: darker deep inside and underneath, brighter on the outer top.
  const leafGeo = useMergedCrowns() ? mergedCrown(blobs, puffs.length * BLOB_TRIANGLES) : merge(puffs);
  leafGeo.computeBoundingSphere();
  const mid = leafGeo.boundingSphere.center, rad = leafGeo.boundingSphere.radius;
  shadeCanopy(leafGeo, mid, rad);
  const woodGeo = merge(wood.map((g) => tint(g, BARK, 0, (c, _x, y) => c.multiplyScalar(0.5 + 0.5 * Math.min(y / (o.height * 0.5), 1)))));
  return { wood: new THREE.Mesh(woodGeo, softMaterial()), leaves: new THREE.Mesh(leafGeo, softMaterial({ sway: 1, leaf: o.leafGrain ?? 1.6, crown: mid.clone(), ...crownLook() })), tips, envelope: {center:leafGeo.boundingSphere.center.clone(),radius:leafGeo.boundingSphere.radius} };
}

/** Pines of stacked jagged tiers (the faceted default). spots: [[x,y,z,height], ...] */
function facetPines(spots, seed, low) {
  const parts = [];
  spots.forEach(([x, y, z, h], i) => {
    const t = (crownMode() === CROWN_MESH_CLAY ? buildClayTree : buildFacetTree)({ archetype: 'pine', seed: seed * 17 + i, height: h, leaf: 1, girth: 1, lod: low ? 'phone' : 'high' }), g = facetParts(t, PINE_COLORS, seed + i);
    parts.push(place(g.wood, x, y, z), place(g.crown, x, y, z));
  });
  const mesh = new THREE.Mesh(merge(parts), softMaterial({ sway: 0.35 }));
  mesh.userData.part = 'trees'; // bench part name
  return mesh;
}

/** Stacked-cone pines. spots: [[x,y,z,height], ...] */
export function pines(spots, seed, low = false) {
  const R = rng(seed), parts = [];
  if (crownMode() === 'facets' || crownMode() === CROWN_MESH_CLAY) return facetPines(spots, seed, low);
  for (const [x, y, z, h] of spots) {
    parts.push(place(tint(new THREE.CylinderGeometry(h * 0.035, h * 0.06, h * 0.3, 6), BARK), x, y + h * 0.15, z));
    const profile=[];
    for(let ring=0;ring<=16;ring++){
      const fraction=ring/16;
      profile.push(new THREE.Vector2(Math.pow(Math.sin(fraction*Math.PI),.65)*(1-fraction*.5)*h*.34,h*(.18+fraction*.82)));
    }
    parts.push(place(tint(new THREE.LatheGeometry(profile,24),'#356e63',0,(color,_x,yy)=>color.lerp(new THREE.Color('#8ba995'),yy/h*.35)),x,y,z));
  }
  const mesh = new THREE.Mesh(merge(parts), softMaterial({ sway: 0.35, leaf: .6 }));
  mesh.userData.part = 'trees'; // bench part name
  return mesh;
}

/** Little glowing mushrooms. spots: [[x,y,z,size], ...] */
export function mushrooms(spots, color = '#7af5e0') {
  const parts = [];
  for (const [x, y, z, s] of spots) {
    parts.push(place(tint(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 6), '#c4b08d', 0), x, y + 0.2 * s, z, 0, 0, 0, s));
    parts.push(place(tint(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, 0.04), x, y + 0.36 * s, z, 0, 0, 0, s, s * 0.8, s));
  }
  return new THREE.Mesh(merge(parts), softMaterial({ fuzz: 0, gloss: 0.7 })); // soft vinyl
}

const GRASS_VERT = /* glsl */ `
varying float vH; varying vec3 vP; varying vec3 vRoot;
${COMMON}
${NOISE}
void main(){
  vec4 root=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
  vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.);
  float h=position.y;
  float phase=hash21(root.xz*3.17)*6.2832;
  float gust=sin(uTime*.55+dot(root.xz,vec2(.18,.12)))*.025;
  float sway=sin(uTime*1.35+phase)*.075;
  vec2 lean=vec2(cos(phase),sin(phase))*sway+vec2(1.,.6)*gust;
  wp.xz+=lean*h*h*uWind;
  vH=h; vP=wp.xyz; vRoot=root.xyz;
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const GRASS_FRAG = /* glsl */ `
varying float vH; varying vec3 vP; varying vec3 vRoot;
const float ROOT_SHADE=${GLADE_GRASS_LOOK.rootShade};
const float ROOT_SHADE_END=${GLADE_GRASS_LOOK.shadeEnd};
${COMMON}
${NOISE}
void main(){
  vec3 v=normalize(cameraPosition-vP);
  float pa=vnoise(vRoot.xz*.22), pb=vnoise(vRoot.xz*.7+31.);
  vec3 base=mix(vec3(.008,.04,.03),vec3(.015,.06,.025),pa);
  vec3 tip=mix(vec3(.03,.17,.07),vec3(.11,.25,.05),pb*pa);
  tip=mix(tip,vec3(.04,.19,.14),smoothstep(.55,.8,vnoise(vRoot.xz*.09+7.))*.6);
  vec3 alb=mix(base,tip,vH*vH);
  alb*=mix(1.-ROOT_SHADE,1.,smoothstep(0.,ROOT_SHADE_END,vH));
  vec3 c=shade(alb,normalize(vec3(0.,1.,0.)+uSun*.3),vP,v);
  // blades lit from behind glow at the tips when you look toward the sun
  c+=alb*vec3(3.,1.5,.5)*pow(max(dot(-v,uSun),0.),3.)*vH*1.6;
  gl_FragColor=vec4(applyFog(c,vP),1.);
}`;

let grassMaterial;

/** Grass blades over an isle top. keep(x,z) => false skips a spot (paths, water, floors). */
export function makeGrass(isle, count, seed, keep = () => true, tall = 1) {
  const blade = new THREE.BufferGeometry();
  const w = 0.085;
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, -w * .9, .4, 0, w * .9, .4, 0, -w * .65, .75, 0, w * .65, .75, 0, -w*.25, .9, 0,w*.25,.9,0], 3));
  blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6,6,5,7]);
  grassMaterial ||= shaderMaterial(GRASS_VERT, GRASS_FRAG, {}, { side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(blade, grassMaterial, count);
  const R = rng(seed), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 6; tries++) {
    const x = (R() * 2 - 1) * isle.r * 1.2, z = (R() * 2 - 1) * isle.r * 1.2;
    if (!isle.inside(x, z, 0.15) || !keep(x, z)) continue;
    const s = (0.38 + R() * 0.5) * tall;
    q.setFromEuler(e.set((R() - 0.5) * 0.3, R() * Math.PI, (R() - 0.5) * 0.3));
    m.compose(V3(x, isle.heightAt(x, z) - 0.03, z), q, V3(0.9 + R() * 0.7, s, 1));
    mesh.setMatrixAt(n++, m);
  }
  mesh.count = n;
  mesh.userData.part = 'grass'; // bench part name
  mesh.frustumCulled = false;
  return mesh;
}
