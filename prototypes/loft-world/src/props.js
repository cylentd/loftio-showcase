// Built things: the loft cottage, the cafe, the camp, the rune ring, and root bridges between isles.
import * as THREE from 'three';
import { COMMON, shaderMaterial, softMaterial } from './glsl.js';
import { V3, blob, merge, place, rng, tint, tube } from './util.js';

const TIMBER = '#5a3a28', PLASTER = '#f0dfbf', LAMP = '#ffb04f';
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);

function tower(parts, x, z, s, roofColor, windows) {
  const P = (g, px, py, pz, ...rest) => parts.push(place(g, x + px * s, py * s, z + pz * s, ...rest));
  P(tint(cyl(2.95, 3.15, 0.7, 20), '#7c6f7a'), 0, 0.3, 0, 0, 0, 0, s);
  P(tint(cyl(2.6, 2.7, 3.5, 24), PLASTER, 0, (c, _x, y) => c.multiplyScalar(0.72 + 0.28 * Math.min((y + 1.75) / 2, 1))), 0, 2.35, 0, 0, 0, 0, s);
  P(tint(cyl(2.7, 2.7, 0.24, 24), TIMBER), 0, 4.05, 0, 0, 0, 0, s);
  P(tint(cyl(2.74, 2.74, 0.2, 24), TIMBER), 0, 0.85, 0, 0, 0, 0, s);
  const spline = new THREE.SplineCurve([[3.8, -0.05], [3.4, 0.4], [2.45, 1.5], [1.6, 2.7], [0.9, 3.8], [0.35, 4.75], [0.02, 5.3]].map(([a, b]) => new THREE.Vector2(a, b)));
  // shingle rows: each row steps out a little and darkens toward its lower edge
  const profile = spline.getPoints(44).map((p, i) => new THREE.Vector2(p.x + (i % 4 === 0 ? 0.07 : 0), p.y));
  P(tint(new THREE.LatheGeometry(profile, 28), roofColor, 0, (c, px, y, pz) => {
    const row = (y * 44 / 5.3 / 4) % 1, tile = Math.sin(Math.atan2(pz, px) * 22 + Math.floor(y * 2.1) * 1.7);
    c.multiplyScalar(0.72 + 0.3 * row + 0.07 * tile + 0.1 * (y / 5));
  }), 0, 4.05, 0, 0, 0, 0, s);
  P(tint(new THREE.SphereGeometry(0.2, 8, 6), LAMP, 0.9), 0, 9.5, 0, 0, 0, 0, s);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    P(tint(box(0.2, 3.2, 0.14), TIMBER), Math.sin(a) * 2.68, 2.45, Math.cos(a) * 2.68, 0, a, 0, s);
  }
  for (const [a, y, size] of windows) {
    const wx = Math.sin(a) * 2.74, wz = Math.cos(a) * 2.74;
    P(tint(new THREE.CircleGeometry(0.55 * size, 18), '#ffb659', 1), wx, y, wz, 0, a, 0, s);
    P(tint(new THREE.TorusGeometry(0.58 * size, 0.09, 6, 20), TIMBER), wx, y, wz, 0, a, 0, s);
    P(tint(box(0.07, 1.1 * size, 0.06), TIMBER), wx * 1.005, y, wz * 1.005, 0, a, 0, s);
    P(tint(box(1.1 * size, 0.07, 0.06), TIMBER), wx * 1.005, y, wz * 1.005, 0, a, 0, s);
  }
}

/** The loft: two round plaster towers with tall curved roofs and lit windows. Local origin on the ground. */
export function makeLoft() {
  const parts = [];
  tower(parts, 0, 0, 1, '#b5523b', [[-0.62, 2.7, 1], [0.78, 2.7, 1], [2.3, 2.9, 0.8], [0.1, 5.9, 0.62]]);
  tower(parts, 3.5, -0.7, 0.62, '#9c4136', [[0.45, 2.6, 0.9], [1.6, 2.6, 0.9]]);
  const a = 0.08, dx = Math.sin(a) * 2.72, dz = Math.cos(a) * 2.72;
  parts.push(place(tint(box(1.05, 1.85, 0.16), '#6d4029'), dx, 1.55, dz, 0, a));
  parts.push(place(tint(new THREE.CircleGeometry(0.525, 14, 0, Math.PI), '#6d4029'), dx, 2.47, dz + 0.085, 0, a));
  parts.push(place(tint(new THREE.SphereGeometry(0.07, 6, 6), LAMP, 1), dx + 0.3, 1.5, dz + 0.12));
  parts.push(place(tint(new THREE.SphereGeometry(0.17, 8, 6), LAMP, 1), dx, 3.25, dz + 0.3));
  parts.push(place(tint(box(1.6, 0.18, 0.9), '#8d8090'), dx, 0.62, dz + 0.45, 0, a));
  parts.push(place(tint(box(0.55, 1.9, 0.55), '#8a7a84'), -1.5, 6.6, -0.6));
  parts.push(place(tint(box(0.7, 0.16, 0.7), TIMBER), -1.5, 7.6, -0.6));
  return new THREE.Mesh(merge(parts), softMaterial({ fuzz: 0.12, gloss: 0.4 })); // glazed ceramic cottage
}

/** Stepping stones along a list of [x,z] points; y from heightAt. */
export function steppingStones(points, heightAt, seed) {
  const R = rng(seed);
  const parts = points.map(([x, z]) => place(
    tint(cyl(0.55, 0.62, 0.14, 9), '#b9a9a6', 0, (c) => c.multiplyScalar(0.85 + R() * 0.15)),
    x, heightAt(x, z) + 0.05, z, 0, R() * 3, 0, 0.8 + R() * 0.45, 1, 0.8 + R() * 0.3,
  ));
  return new THREE.Mesh(merge(parts), softMaterial());
}

/** Lanterns hanging under branch tips. tips are world points. */
export function lanterns(tips, seed) {
  const R = rng(seed), parts = [];
  for (const t of tips) {
    const drop = 1.2 + R() * 2.2;
    parts.push(place(tint(cyl(0.015, 0.015, drop, 4), '#2c1f1a'), t.x, t.y - drop / 2, t.z));
    parts.push(place(tint(new THREE.SphereGeometry(0.2, 8, 6), R() < 0.75 ? LAMP : '#8ff5e0', 1), t.x, t.y - drop - 0.15, t.z, 0, 0, 0, 1, 1.25, 1));
    parts.push(place(tint(new THREE.ConeGeometry(0.2, 0.16, 6), TIMBER), t.x, t.y - drop + 0.18, t.z));
  }
  return new THREE.Mesh(merge(parts), softMaterial({ sway: 0.5 }));
}

/** Beach cafe: kiosk with a striped awning, two parasol tables, string lights. Local origin on the ground. */
export function makeCafe(heightAt) {
  const parts = [], y0 = heightAt(0, -1);
  const stripe = (i) => (i % 2 ? '#fbf1dd' : '#e6604c');
  parts.push(place(tint(box(4.2, 2.5, 2.8), '#f3e6cf', 0, (c, _x, y) => c.multiplyScalar(0.75 + 0.25 * (y + 1.25) / 2.5)), 0, y0 + 1.25, -1.6));
  parts.push(place(tint(box(4.5, 0.2, 3.1), '#3e8f8a'), 0, y0 + 2.6, -1.6));
  parts.push(place(tint(box(3.4, 1.0, 0.1), '#ffc46b', 0.85), 0, y0 + 1.75, -0.18));
  parts.push(place(tint(box(3.9, 0.14, 0.6), TIMBER), 0, y0 + 1.1, 0.05));
  for (let i = 0; i < 9; i++) parts.push(place(tint(box(0.5, 0.07, 1.7), stripe(i)), -2 + i * 0.5, y0 + 2.35, 0.5, 0.42));
  parts.push(place(tint(box(1.5, 0.5, 0.08), '#ffd98a', 0.9), 0, y0 + 3.1, -0.3));
  for (const [x, z, hue] of [[-4.6, 2.2, '#e6604c'], [4.2, 3.0, '#3e8f8a']]) {
    const y = heightAt(x, z);
    parts.push(place(tint(cyl(0.05, 0.05, 2.5, 6), '#efe6d8'), x, y + 1.25, z));
    parts.push(place(tint(new THREE.ConeGeometry(1.7, 0.75, 12), '#ffffff', 0, (c, px, _y, pz) => {
      c.set(Math.floor((Math.atan2(pz, px) / (Math.PI * 2) + 0.5) * 12) % 2 ? '#fbf1dd' : hue);
    }), x, y + 2.6, z));
    parts.push(place(tint(cyl(0.7, 0.7, 0.07, 14), '#fbf1dd'), x, y + 0.85, z));
    parts.push(place(tint(cyl(0.07, 0.12, 0.85, 6), TIMBER), x, y + 0.42, z));
    parts.push(place(tint(new THREE.SphereGeometry(0.09, 6, 6), LAMP, 1), x, y + 1.0, z));
  }
  // string lights: bulbs on sagging lines between poles
  const poles = [[-6.2, -1.5], [-1.5, 5.6], [5.8, 0.4], [2.4, -3.2]].map(([x, z]) => V3(x, heightAt(x, z) + 3.6, z));
  const bulbs = ['#ffb04f', '#ff8fb8', '#8ff5e0', '#ffe08a'];
  poles.forEach((p, i) => {
    parts.push(place(tint(cyl(0.06, 0.08, 3.6, 6), TIMBER), p.x, p.y - 1.8, p.z));
    const q = poles[(i + 1) % poles.length];
    for (let k = 1; k < 9; k++) {
      const f = k / 9, sag = Math.sin(f * Math.PI) * 0.9;
      parts.push(place(tint(new THREE.SphereGeometry(0.12, 6, 5), bulbs[(k + i) % 4], 1), p.x + (q.x - p.x) * f, p.y + (q.y - p.y) * f - sag, p.z + (q.z - p.z) * f));
    }
  });
  return new THREE.Mesh(merge(parts), softMaterial());
}

/** Camp: tent, log seats, fire ring. Returns { mesh, flame } so the flame can flicker. */
export function makeCamp(heightAt) {
  const parts = [], y = (x, z) => heightAt(x, z);
  parts.push(place(tint(new THREE.ConeGeometry(2.6, 3.1, 4), '#e9a14a', 0, (c, _x, py) => c.lerp(new THREE.Color('#fbe7c0'), Math.max(py / 3.1 + 0.2, 0) * 0.5)), -2.6, y(-2.6, -1.5) + 1.5, -1.5, 0, 0.6));
  parts.push(place(tint(new THREE.ConeGeometry(0.9, 1.9, 3), '#3a2230'), -1.45, y(-1.4, -0.4) + 0.95, -0.35, 0, 0.6 + Math.PI / 6));
  parts.push(place(tint(new THREE.SphereGeometry(0.16, 8, 6), LAMP, 1), -1.3, y(-1.3, -0.3) + 2.0, -0.2));
  for (const [x, z, r] of [[1.2, 3.4, 0.4], [3.9, 1.0, 1.5], [3.2, 3.6, 0.95]]) {
    parts.push(place(tint(cyl(0.3, 0.3, 1.9, 8), '#6a4630'), x, y(x, z) + 0.28, z, 0, r, Math.PI / 2));
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    parts.push(place(tint(blob(k, 0.2, 1.5, 1), '#8a7c88'), 1.6 + Math.cos(a) * 0.75, y(1.6, 1.6) + 0.1, 1.6 + Math.sin(a) * 0.75, 0, k, 0, 0.24));
  }
  parts.push(place(tint(cyl(0.09, 0.09, 1.1, 6), '#3a251c'), 1.6, y(1.6, 1.6) + 0.16, 1.6, 0, 0.5, Math.PI / 2));
  parts.push(place(tint(cyl(0.09, 0.09, 1.1, 6), '#3a251c'), 1.6, y(1.6, 1.6) + 0.2, 1.6, 0, 2.1, Math.PI / 2));
  const flame = new THREE.Mesh(
    merge([
      place(tint(new THREE.ConeGeometry(0.42, 1.25, 7), '#ff8a2a', 1), 0, 0.62, 0),
      place(tint(new THREE.ConeGeometry(0.22, 0.8, 6), '#ffe08a', 1), 0.05, 0.45, 0.02),
    ]),
    softMaterial(),
  );
  flame.position.set(1.6, y(1.6, 1.6) + 0.15, 1.6);
  flame.scale.setScalar(1.5);
  return { mesh: new THREE.Mesh(merge(parts), softMaterial()), flame };
}

const RUNE_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vP;
void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`;

const RUNE_FRAG = /* glsl */ `
varying vec2 vUv; varying vec3 vP;
${COMMON}
void main(){
  vec2 p=vUv*2.-1.; float r=length(p), a=atan(p.y,p.x);
  float ring=smoothstep(.022,0.,abs(r-.93))+smoothstep(.016,0.,abs(r-.64))+smoothstep(.012,0.,abs(r-.2));
  float s=fract(a/6.2832*3.-log(r+.02)*1.25+uTime*.03);
  float arm=smoothstep(.07,0.,abs(s-.5))*smoothstep(.2,.26,r)*smoothstep(.64,.56,r);
  float tick=step(.55,fract(a/6.2832*28.+.5))*smoothstep(.035,.02,abs(r-.785));
  float dots=smoothstep(.04,.02,length(vec2(fract(a/6.2832*7.)-.5,(r-.42)*4.)));
  float pulse=.65+.35*sin(uTime*1.4-r*7.);
  vec3 col=mix(vec3(.25,1.,.8),vec3(1.,.72,.3),smoothstep(.25,.95,r));
  float e=(ring+arm*.9+tick*.7+dots*.6)*pulse;
  float fog=exp(-length(vP-cameraPosition)*uFog);
  gl_FragColor=vec4(col*e*4.5*fog+col*.1*smoothstep(1.,.1,r)*fog,1.);
}`;

const BEAM_FRAG = /* glsl */ `
varying vec2 vUv; varying vec3 vP;
${COMMON}
void main(){
  float up=1.-vUv.y;
  float streak=.6+.4*sin(vUv.x*60.+uTime*.6)*sin(vUv.x*23.-uTime*.35);
  float fog=exp(-length(vP-cameraPosition)*uFog);
  gl_FragColor=vec4(vec3(.25,1.,.8)*up*up*streak*.2*fog,1.);
}`;

/** Rumble glade: a rune ring on the grass, standing stones, a soft column of light, drifting shards. */
export function makeGlade(heightAt) {
  const group = new THREE.Group(), y0 = heightAt(0, 0);
  const add = { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide };
  const ring = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), shaderMaterial(RUNE_VERT, RUNE_FRAG, {}, add));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = y0 + 0.14;
  group.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 6.6, 17, 48, 1, true), shaderMaterial(RUNE_VERT, BEAM_FRAG, {}, add));
  beam.position.y = y0 + 8.5;
  group.add(beam);

  const R = rng(41), parts = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3, x = Math.cos(a) * 8.6, z = Math.sin(a) * 8.6, h = 2.8 + R() * 1.6;
    const g = new THREE.CapsuleGeometry(0.72, 1.0, 6, 16); // a rounded pill, like a soft toy block
    parts.push(place(tint(g, '#8d84a6', 0, (c, _x, py) => c.multiplyScalar(0.5 + 0.5 * (py + 1) / 2)), x, heightAt(x, z) + h * 0.48, z, (R() - 0.5) * 0.2, -a + Math.PI / 2, (R() - 0.5) * 0.2, 0.8, h * 0.5, 0.8));
    for (let j = 0; j < 3; j++) parts.push(place(tint(new THREE.TorusGeometry(0.16 - j * 0.03, 0.035, 5, 14), '#63f2d4', 1), x - Math.cos(a) * 0.45, heightAt(x, z) + h * (0.3 + j * 0.2), z - Math.sin(a) * 0.45, 0, -a + Math.PI / 2, 0));
  }
  group.add(new THREE.Mesh(merge(parts), softMaterial()));

  const shards = new THREE.Group(), sp = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2, rad = 3.5 + R() * 2.2;
    sp.push(place(tint(blob(k + 60, 0.3, 1.8, 1), k % 3 ? '#7d6f96' : '#63f2d4', k % 3 ? 0 : 0.75), Math.cos(a) * rad, 3.5 + R() * 7, Math.sin(a) * rad, R() * 3, R() * 3, R() * 3, 0.3 + R() * 0.2, 0.34 + R() * 0.2, 0.3)); // round beads, not shards
  }
  shards.add(new THREE.Mesh(merge(sp), softMaterial()));
  shards.position.y = y0;
  group.add(shards);
  return { group, shards };
}

/** A plank bridge with living-root rails and glow buds, sagging between two world points. */
export function makeBridge(a, b, seed, sag = 0.08) {
  const R = rng(seed), len = a.distanceTo(b);
  const mid = a.clone().lerp(b, 0.5); mid.y -= len * sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const n = Math.round(len / 0.62), parts = [];
  const side = V3(), tan = V3(), up = V3(0, 1, 0);
  const railL = [], railR = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, p = curve.getPoint(f);
    curve.getTangent(f, tan);
    side.crossVectors(tan, up).normalize();
    const yaw = Math.atan2(tan.x, tan.z), pitch = -Math.asin(tan.y);
    parts.push(place(tint(box(1.7, 0.09, 0.46), '#c9a57a', 0, (c) => c.multiplyScalar(0.75 + R() * 0.25)), p.x, p.y, p.z, pitch, yaw, (R() - 0.5) * 0.06));
    const wob = Math.sin(f * len * 0.45) * 0.12, lift = 0.75 + Math.sin(f * Math.PI) * 0.15;
    railL.push(p.clone().addScaledVector(side, 0.92 + wob).add(V3(0, lift + wob, 0)));
    railR.push(p.clone().addScaledVector(side, -0.92 + wob).add(V3(0, lift - wob, 0)));
    if (i % 5 === 0) {
      for (const sgn of [1, -1]) {
        const q = p.clone().addScaledVector(side, 0.9 * sgn);
        parts.push(place(tint(cyl(0.05, 0.06, lift + 0.1, 5), TIMBER), q.x, q.y + lift / 2, q.z));
        if (i % 10 === 0) parts.push(place(tint(new THREE.SphereGeometry(0.13, 6, 5), '#8ff5e0', 1), q.x, q.y + lift + 0.22, q.z));
      }
    }
  }
  const taper = railL.map((_, i) => 0.1 + 0.07 * Math.abs(Math.cos((i / n) * Math.PI)));
  parts.push(tint(tube(railL, taper, 5), '#6a4630'));
  parts.push(tint(tube(railR, taper, 5), '#6a4630'));
  return new THREE.Mesh(merge(parts), softMaterial());
}
