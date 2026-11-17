// Trees grown from a seed, pines, glow mushrooms, and wind-blown grass.
import * as THREE from 'three';
import { COMMON, NOISE, shaderMaterial, softMaterial } from './glsl.js';
import { V3, blob, merge, place, rng, tint, tube } from './util.js';

import {leafGeometry} from './woodland-view.js';
const BARK = '#5a4936';

/**
 * o: { seed, height, girth, leaf (puff size), depth (branch levels), spread, palette:[dark, light, accent] }
 * Returns { wood, leaves, tips } where tips are branch-end points (for lanterns), all in tree-local coords.
 */
export function makeTree(o) {
  const R = rng(o.seed), wood = [], puffs = [], tips = [];
  const dark = new THREE.Color(o.palette[0]), light = new THREE.Color(o.palette[1]), accent = new THREE.Color(o.palette[2]);

  function puff(p, size) {
    // A soft full core gives the crown its mass; leaves standing off its surface give it a leafy edge.
    const core = blob(o.seed + puffs.length * 1.37, 0.055, 1.4, 3), warm = R() < 0.22, mix = R();
    puffs.push(place(
      tint(core, '#ffffff', 0, (c, _x, y) => {
        c.copy(dark).lerp(light, Math.min(Math.max(y * 0.6 + 0.45 + mix * 0.2, 0), 1));
        if (warm) c.lerp(accent, 0.35 * Math.max(y, 0));
      }),
      p.x, p.y, p.z, 0, R() * 6, 0, size * 1.15, size * (0.72 + R() * 0.14), size * (0.95 + R() * 0.2),
    ));
    // small round poms on the surface break up the outline. Nothing pointed: this is a soft toy of a tree.
    for (let i = 0; i < 2; i++) {
      const a = R() * Math.PI * 2, up = R() * 1.5 - 0.4, ring = Math.sqrt(Math.max(1 - Math.min(up, 1) ** 2, 0.05)), pom = size * (0.26 + R() * 0.16);
      const c = dark.clone().lerp(light, 0.4 + Math.max(up, 0) * 0.45 + R() * 0.15);
      if (i % 4 === 0) c.lerp(accent, 0.35);
      puffs.push(place(tint(blob(o.seed + i * 2.1 + puffs.length, 0.04, 1.4, 2), c, 0, (cc, _x, y) => cc.multiplyScalar(0.8 + 0.2 * (y + 1) / 2)),
        p.x + Math.cos(a) * ring * size * 0.66, p.y + up * size * 0.46, p.z + Math.sin(a) * ring * size * 0.66, 0, R() * 6, 0, pom, pom * 0.85, pom));
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
  const leafGeo = merge(puffs), lp = leafGeo.attributes.position, lc = leafGeo.attributes.aCol;
  leafGeo.computeBoundingSphere();
  const mid = leafGeo.boundingSphere.center, rad = leafGeo.boundingSphere.radius;
  for (let i = 0; i < lp.count; i++) {
    const dx = lp.getX(i) - mid.x, dy = lp.getY(i) - mid.y, dz = lp.getZ(i) - mid.z;
    const out = Math.min(Math.hypot(dx, dy, dz) / rad, 1), k = (0.45 + 0.75 * out * out) * (0.8 + 0.35 * Math.min(Math.max(dy / rad + 0.5, 0), 1));
    lc.setXYZ(i, lc.getX(i) * k, lc.getY(i) * k, lc.getZ(i) * k);
  }
  const woodGeo = merge(wood.map((g) => tint(g, BARK, 0, (c, _x, y) => c.multiplyScalar(0.5 + 0.5 * Math.min(y / (o.height * 0.5), 1)))));
  return { wood: new THREE.Mesh(woodGeo, softMaterial()), leaves: new THREE.Mesh(leafGeo, softMaterial({ sway: 1, leaf: o.leafGrain ?? 1.6 })), tips, envelope: {center:leafGeo.boundingSphere.center.clone(),radius:leafGeo.boundingSphere.radius} };
}

/** Stacked-cone pines. spots: [[x,y,z,height], ...] */
export function pines(spots, seed) {
  const R = rng(seed), parts = [];
  for (const [x, y, z, h] of spots) {
    parts.push(place(tint(new THREE.CylinderGeometry(h * 0.035, h * 0.06, h * 0.3, 6), BARK), x, y + h * 0.15, z));
    const profile=[];
    for(let ring=0;ring<=16;ring++){
      const fraction=ring/16;
      profile.push(new THREE.Vector2(Math.pow(Math.sin(fraction*Math.PI),.65)*(1-fraction*.5)*h*.34,h*(.18+fraction*.82)));
    }
    parts.push(place(tint(new THREE.LatheGeometry(profile,24),'#356e63',0,(color,_x,yy)=>color.lerp(new THREE.Color('#8ba995'),yy/h*.35)),x,y,z));
  }
  return new THREE.Mesh(merge(parts), softMaterial({ sway: 0.35, leaf: .6 }));
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
void main(){
  vec4 root=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
  vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.);
  float h=position.y;
  float gust=sin(uTime*.55+root.x*.09+root.z*.07);
  float w=sin(uTime*1.7+root.x*.6+root.z*.45)*.55+sin(uTime*3.1+root.x*1.4)*.2+gust*.7;
  wp.x+=w*h*h*.34*uWind; wp.z+=w*h*h*.2*uWind; wp.y-=abs(w)*h*h*.08*uWind;
  vH=h; vP=wp.xyz; vRoot=root.xyz;
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const GRASS_FRAG = /* glsl */ `
varying float vH; varying vec3 vP; varying vec3 vRoot;
${COMMON}
${NOISE}
void main(){
  vec3 v=normalize(cameraPosition-vP);
  float pa=vnoise(vRoot.xz*.22), pb=vnoise(vRoot.xz*.7+31.);
  vec3 base=mix(vec3(.008,.04,.03),vec3(.015,.06,.025),pa);
  vec3 tip=mix(vec3(.03,.17,.07),vec3(.11,.25,.05),pb*pa);
  tip=mix(tip,vec3(.04,.19,.14),smoothstep(.55,.8,vnoise(vRoot.xz*.09+7.))*.6);
  vec3 alb=mix(base,tip,vH*vH);
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
  mesh.frustumCulled = false;
  return mesh;
}
