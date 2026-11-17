// The valley floor: one height function, the ground mesh, and a meadow of grass that follows the camera.
import * as THREE from 'three';
import { COMMON, NOISE, shaderMaterial } from './glsl.js';
import { fbm, rng } from './util.js';
import { MEADOW_LOOK } from './terrain-look-data.mjs';

export const LAND = {
  half: 210, // the detailed play area is 420 across; height and mask textures cover it
  far: 430, // the coarse outer ring (mountains) reaches this far
  water: -1.5, // lake surface height
  lake: [85, 25, 30], // x, z, radius
  knoll: [0, 0, 32, 9], // x, z, radius, height: where the loft stands
  ridge: [-78, -28, 30, 13], // camp ridge
  mountainsFrom: 150,
  creek: [[-25, -170], [-40, -110], [-48, -60], [-42, -10], [-15, 40], [30, 52], [58, 38]],
  creekTop: 7, // creek surface height where it leaves the mountains
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

/** flats: [[x, z, radius]] spots levelled for buildings. */
export function createTerrain(flats, low) {
  const L = LAND;
  const rolling = (x, z) => {
    const d = Math.hypot(x, z);
    let h = (fbm(x * 0.012 + 3, z * 0.012, 1.7, 4) - 0.5) * 20 + (fbm(x * 0.045, z * 0.045, 9.1, 3) - 0.5) * 3.5 + 2;
    h += L.knoll[3] * gauss(Math.hypot(x - L.knoll[0], z - L.knoll[1]) / L.knoll[2]);
    h += L.ridge[3] * gauss(Math.hypot(x - L.ridge[0], z - L.ridge[1]) / L.ridge[2]);
    const m = smooth(L.mountainsFrom, 300, d);
    const skyline = .35 + .65 * smooth(-.3,.7,Math.sin(Math.atan2(z,x)*3+1));
    h += m * m * (32 + 48 * fbm(x * 0.011, z * 0.011, 5.5, 4)) * skyline;
    h -= smooth(335, L.far, d) * 170;
    return h;
  };
  const pads = flats.map(([x, z, r]) => ({ x, z, r, y: rolling(x, z) }));
  const creekY = (t) => L.creekTop + (L.water - L.creekTop) * t;

  const heightAt = (x, z) => {
    let h = rolling(x, z);
    const [cd, ct] = along(L.creek, x, z);
    if (cd < 10) h += (creekY(ct) - 0.9 - h) * smooth(10, 2.2, cd);
    const ld = Math.hypot(x - L.lake[0], z - L.lake[1]) / L.lake[2];
    if (ld < 1.7) { h += (L.water + 1.1 - h) * smooth(1.7, 1.15, ld); h += (L.water - 6 - h) * smooth(1.08, 0.55, ld); }
    for (const p of pads) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r * 1.8) h += (p.y - h) * smooth(p.r * 1.8, p.r, d);
    }
    return h;
  };
  const normalAt = (x, z, out) => out.set(heightAt(x - 0.6, z) - heightAt(x + 0.6, z), 1.2, heightAt(x, z - 0.6) - heightAt(x, z + 0.6)).normalize();

  /** 0..1 masks at a point: dirt path, sand (lake shore), creek bed. */
  const maskAt = (x, z) => {
    let path = 0;
    for (const line of L.paths) path = Math.max(path, 1 - smooth(1.1, 2.4, along(line, x, z)[0]));
    const ld = Math.hypot(x - L.lake[0], z - L.lake[1]) / L.lake[2];
    const sand = smooth(1.62, 1.3, ld + (fbm(x * 0.08, z * 0.08, 4, 2) - 0.5) * 0.25);
    const wet = Math.max(1 - smooth(2.4, 4.2, along(L.creek, x, z)[0]), smooth(1.12, 1.02, ld));
    return { path, sand, wet };
  };

  // ---- Textures over the play area: height for the grass, masks for ground colour ----
  const HS = 512, heights = new Uint16Array(HS * HS * 4);
  for (let j = 0; j < HS; j++) for (let i = 0; i < HS; i++) {
    const x = (i / (HS - 1) * 2 - 1) * L.half, z = (j / (HS - 1) * 2 - 1) * L.half, k = (j * HS + i) * 4;
    heights[k] = THREE.DataUtils.toHalfFloat(heightAt(x, z));
  }
  const heightTex = new THREE.DataTexture(heights, HS, HS, THREE.RGBAFormat, THREE.HalfFloatType);
  heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter;
  heightTex.needsUpdate = true;

  const MS = low ? 512 : 1024, masks = new Uint8Array(MS * MS * 4);
  for (let j = 0; j < MS; j++) for (let i = 0; i < MS; i++) {
    const x = (i / (MS - 1) * 2 - 1) * L.half, z = (j / (MS - 1) * 2 - 1) * L.half, k = (j * MS + i) * 4, m = maskAt(x, z);
    masks[k] = m.path * 255; masks[k + 1] = m.sand * 255; masks[k + 2] = m.wet * 255;
    masks[k + 3] = (1 - Math.max(m.path, m.sand, m.wet)) * 255; // where grass grows
  }
  const maskTex = new THREE.DataTexture(masks, MS, MS, THREE.RGBAFormat, THREE.UnsignedByteType);
  maskTex.magFilter = maskTex.minFilter = THREE.LinearFilter;
  maskTex.needsUpdate = true;
  const shared = {
    uHeightTex: { value: heightTex }, uMaskTex: { value: maskTex }, uHalf: { value: L.half }, uFocus: { value: new THREE.Vector3() },
    uGroundGrain:{value:MEADOW_LOOK.groundGrain},uGroundMottle:{value:MEADOW_LOOK.groundMottle},uMeadowSoftness:{value:MEADOW_LOOK.softness},
    uBodies: { value: [0, 1, 2].map(() => new THREE.Vector3(0, -999, 0)) }, // residents: the grass leans away from them
    uGarden: { value: new THREE.Vector3(0, 0, 0) }, // x, z, radius: a garden where flowers always grow
    uPop: { value: new THREE.Vector4(0, 0, 0, 0) }, uPopPower: { value: 0 }, // a shockwave: centre, current radius, strength
  };

  // ---- Ground: a fine inner sheet and a coarse outer ring for the mountains ----
  const GRASS = new THREE.Color('#49775d'), GRASS2 = new THREE.Color('#759575'), ROCK = new THREE.Color('#394a60'), ROCK2 = new THREE.Color('#56677c'), SNOW = new THREE.Color('#c4d1dd');
  function sheet(size, seg, drop) {
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z);
      const inside = drop && Math.max(Math.abs(x), Math.abs(z)) < L.half - 8;
      p.setY(i, inside ? h - 3 : h);
      const slope = 1 - (heightAt(x + 1.5, z) - h) ** 2 / 2.25 - (heightAt(x, z + 1.5) - h) ** 2 / 2.25;
      c.copy(GRASS).lerp(GRASS2, fbm(x * 0.03, z * 0.03, 2, 3));
      const rocky = Math.max(smooth(0.72, 0.4, slope), smooth(38, 62, h));
      c.lerp(c2.copy(ROCK).lerp(ROCK2, fbm(x * 0.05, h * 0.2, z * 0.05, 2)), rocky);
      c.lerp(SNOW, smooth(78, 100, h + fbm(x * 0.04, z * 0.04, 7, 2) * 20));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }
  const c2 = new THREE.Color();
  const groundMat = shaderMaterial(GROUND_VERT, GROUND_FRAG, shared);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(sheet(L.half * 2, low ? 200 : 300, false), groundMat));
  group.add(new THREE.Mesh(sheet(L.far * 2, 150, true), groundMat));

  // ---- Meadow: blades live in one square tile that wraps around the focus point ----
  const TILE = low ? 70 : 96, COUNT = low ? MEADOW_LOOK.phoneCount : MEADOW_LOOK.desktopCount;
  const blade = new THREE.BufferGeometry(), w = MEADOW_LOOK.width;
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, -w * 0.9, 0.45, 0, w * 0.9, 0.45, 0, -w * 0.72, 0.8, 0, w * 0.72, 0.8, 0, -w * 0.36, 0.97, 0, w * 0.36, 0.97, 0], 3)); // a rounded tip
  blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6, 6, 5, 7]);
  const meadow = new THREE.InstancedMesh(blade, shaderMaterial(MEADOW_VERT, MEADOW_FRAG, { ...shared, uTile: { value: TILE } }, { side: THREE.DoubleSide }), COUNT);
  const R = rng(17), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    q.setFromEuler(e.set((R() - 0.5) * 0.35, R() * Math.PI, (R() - 0.5) * 0.35));
    meadow.setMatrixAt(i, m.compose(v.set(R() * TILE, 0, R() * TILE), q, s.set(1 + R() * 0.8, MEADOW_LOOK.heightMin + R() * MEADOW_LOOK.heightSpan, 1)));
  }
  meadow.frustumCulled = false;
  group.add(meadow);

  // ---- Flowers: the same wrapping trick, with a bloom on each stem, growing in drifts of one colour ----
  const FLOWERS = low ? 3500 : 8000, bloom = new THREE.BufferGeometry(), sw = 0.022, hw = 0.1; // the head is as tall as it is wide: a dot, not a dart // fewer and smaller: dots of colour, not confetti
  bloom.setAttribute('position', new THREE.Float32BufferAttribute([-sw, 0, 0, sw, 0, 0, -sw, 0.8, 0, sw, 0.8, 0, -hw, 0.88, 0, hw, 0.88, 0, 0, 0.88 + hw, 0, 0, 0.88 - hw, 0], 3));
  bloom.setIndex([0, 1, 2, 2, 1, 3, 7, 5, 6, 7, 6, 4]);
  const flowers = new THREE.InstancedMesh(bloom, shaderMaterial(MEADOW_VERT, MEADOW_FRAG, { ...shared, uTile: { value: TILE }, uFlower: { value: 1 } }, { side: THREE.DoubleSide }), FLOWERS);
  meadow.material.uniforms.uFlower = { value: 0 };
  for (let i = 0; i < FLOWERS; i++) {
    q.setFromEuler(e.set((R() - 0.5) * 0.3, R() * Math.PI, (R() - 0.5) * 0.3));
    const fs = 0.7 + R() * 0.5;
    flowers.setMatrixAt(i, m.compose(v.set(R() * TILE, 0, R() * TILE), q, s.set(fs, fs, 1)));
  }
  flowers.frustumCulled = false;
  group.add(flowers);

  return { group, heightAt, normalAt, maskAt, creekY, meadow, uniforms: shared, focus: shared.uFocus.value, bodies: shared.uBodies.value };
}

const GROUND_VERT = /* glsl */ `
attribute vec3 aCol;
varying vec3 vCol; varying vec3 vN; varying vec3 vP;
void main(){ vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); vCol=aCol; gl_Position=projectionMatrix*viewMatrix*wp; }`;

const GROUND_FRAG = /* glsl */ `
varying vec3 vCol; varying vec3 vN; varying vec3 vP;
uniform sampler2D uMaskTex; uniform float uHalf; uniform float uGroundGrain; uniform float uGroundMottle;
${COMMON}
${NOISE}
void main(){
  vec3 v=normalize(cameraPosition-vP);
  vec3 n=normalize(vN);
  vec2 uv=(vP.xz+uHalf)/(2.*uHalf);
  vec4 mk=(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.) ? texture2D(uMaskTex,uv) : vec4(0.,0.,0.,1.);
  float mottle=vnoise(vP.xz*.35)*.6+vnoise(vP.xz*1.7)*.4;
  vec3 alb=vCol*(1.+uGroundMottle*(mottle-.5));
  vec3 dirt=mix(vec3(.3,.2,.12),vec3(.42,.3,.18),mottle);
  vec3 sand=mix(vec3(.62,.47,.28),vec3(.78,.62,.4),vnoise(vP.xz*.9));
  vec3 bed=vec3(.12,.13,.14)+.08*mottle;
  alb=mix(alb,sand,mk.g);
  alb=mix(alb,dirt,mk.r);
  alb=mix(alb,bed,mk.b);
  // the ground is flocked like a model-railway mat: fine grain, soft halo at grazing angles
  alb*=1.+(vnoise(vP.xz*9.)-.5)*uGroundGrain*(1.-mk.r)*(1.-mk.b);
  vec3 c=shade(alb,n,vP,v);
  c+=alb*vec3(.5,.56,.95)*pow(1.-clamp(dot(n,v),0.,1.),2.2)*.45*(1.-mk.b);
  gl_FragColor=vec4(clamp(applyFog(c,vP),0.,40.),1.);
}`;

const MEADOW_VERT = /* glsl */ `
uniform sampler2D uHeightTex; uniform sampler2D uMaskTex; uniform float uHalf; uniform float uTile; uniform vec3 uFocus; uniform vec3 uBodies[3]; uniform float uFlower; uniform vec4 uPop; uniform float uPopPower; uniform vec3 uGarden;
varying float vH; varying vec3 vP; varying vec3 vRoot;
${COMMON}
${NOISE}
void main(){
  vec3 seat=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
  vec2 rel=mod(seat.xz-uFocus.xz+uTile*.5,uTile)-uTile*.5;
  vec2 xz=uFocus.xz+rel;
  vec2 uv=(xz+uHalf)/(2.*uHalf);
  float grows=texture2D(uMaskTex,uv).a;
  float keep=(1.-smoothstep(uTile*.5-12.,uTile*.5-1.,length(rel)))*smoothstep(.35,.7,grows);
  // the meadow is lush everywhere; blades just run shorter and taller in drifts
  keep*=mix(.72,1.,smoothstep(.25,.75,vnoise(xz*.09)));
  // flowers only grow in drifts
  if(uFlower>.5){
    float garden=1.-smoothstep(uGarden.z*.55,uGarden.z,distance(xz,uGarden.xy));
    keep*=max(smoothstep(.52,.7,vnoise(xz*.045+11.))*step(.35,fract(seat.x*7.31+seat.z*3.17)),garden*step(.8,fract(seat.x*7.31+seat.z*3.17)));
  }
  keep*=step(abs(xz.x),uHalf-2.)*step(abs(xz.y),uHalf-2.);
  vec3 root=vec3(xz.x,texture2D(uHeightTex,uv).r-.04,xz.y);
  vec3 local=mat3(instanceMatrix)*position*keep;
  local.xz+=vec2(.14,.08)*position.y*position.y*keep;
  float h=position.y;
  float gust=sin(uTime*.55+root.x*.09+root.z*.07);
  float w=sin(uTime*1.7+root.x*.6+root.z*.45)*.55+sin(uTime*3.1+root.x*1.4)*.2+gust*.7;
  vec3 wp=root+local;
  wp.x+=w*h*h*.34*uWind*keep; wp.z+=w*h*h*.2*uWind*keep; wp.y-=abs(w)*h*h*.08*uWind*keep;
  for(int i=0;i<3;i++){
    vec2 away=root.xz-uBodies[i].xz; float d=length(away);
    float press=(1.-smoothstep(.4,2.6,d))*(1.-smoothstep(1.5,3.5,uBodies[i].y-root.y))*keep;
    wp.xz+=away/max(d,.05)*press*h*1.2; wp.y-=press*h*.6;
  }
  // a shockwave passing through: blades at the wavefront are thrown flat, outward
  if(uPopPower>0.){
    vec2 out2=root.xz-uPop.xz; float od=length(out2);
    float front=(1.-smoothstep(0.,3.2,abs(od-uPop.w)))*uPopPower*keep;
    wp.xz+=out2/max(od,.05)*front*h*1.6; wp.y-=front*h*.7;
  }
  vH=h; vP=wp; vRoot=root;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
}`;

const MEADOW_FRAG = /* glsl */ `
varying float vH; varying vec3 vP; varying vec3 vRoot;
uniform float uMeadowSoftness; uniform float uFlower;
${COMMON}
${NOISE}
void main(){
  vec3 v=normalize(cameraPosition-vP);
  if(uFlower>.5&&vH>.72){
    // each drift is one colour: pink, cream, lilac or sky blue; blooms carry a little of their own light
    float pick=vnoise(vRoot.xz*.03+40.)*4.;
    vec3 petal=pick<1.3?vec3(1.,.42,.62):pick<2.?vec3(1.,.86,.5):pick<2.7?vec3(.72,.56,1.):vec3(.5,.82,1.);
    petal*=.75+.5*hash21(floor(vRoot.xz*3.));
    vec3 lit=shade(petal*.5,vec3(0.,1.,0.),vP,v)+petal*.5;
    gl_FragColor=vec4(applyFog(lit,vP),1.);
    return;
  }
  float pa=vnoise(vRoot.xz*.22), pb=vnoise(vRoot.xz*.7+31.);
  vec3 base=mix(vec3(.008,.04,.03),vec3(.015,.06,.025),pa);
  vec3 tip=mix(vec3(.03,.17,.07),vec3(.11,.25,.05),pb*pa);
  tip=mix(tip,vec3(.04,.19,.14),smoothstep(.55,.8,vnoise(vRoot.xz*.09+7.))*.6);
  vec3 alb=mix(mix(base,tip,uMeadowSoftness),tip,vH*vH);
  vec3 c=shade(alb,normalize(vec3(0.,1.,0.)+uSun*.3),vP,v);
  c+=alb*vec3(3.,1.5,.5)*pow(max(dot(-v,uSun),0.),3.)*vH*1.6;
  gl_FragColor=vec4(applyFog(c,vP),1.);
}`;
