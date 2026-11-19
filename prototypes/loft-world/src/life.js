// Things that live in the valley and move on their own: butterflies around you, birds wheeling overhead,
// fish jumping in the lake, and fluffs: small round critters that hop about and bolt when you come close.
import * as THREE from 'three';
import { COMMON, shaderMaterial, softMaterial } from './glsl.js';
import { V3, blob, merge, place, rng, tint } from './util.js';

export const LIFE = {
  butterflies: [24, 12], // desktop, phone: how many flutter in the patch around you (was 45 and 22; owner, 2026-11-18: "might be too many butterflies")
  butterflyTile: 84, // the patch is this wide and follows you, like the grass
  birds: 18,
  fluffs: 26,
  fluffScare: 10, // a fluff bolts when you are this close
  fluffCalm: 17, // and settles once you are this far
  fishEvery: [1.4, 4], // seconds between jumps, shortest and longest
  fishHeight: 2.7,
};

const WING_VERT = /* glsl */ `
attribute vec3 aSeat; attribute vec4 aSeed; // phase, pace, size, hue
uniform sampler2D uHeightTex; uniform float uHalf; uniform float uTile; uniform vec3 uFocus; uniform float uBird;
varying float vHue; varying float vShade; varying vec3 vP;
${COMMON}
vec3 trail(float t){
  // butterflies wander in loops near home; birds sweep a wide circle
  return uBird>.5 ? vec3(cos(t*.22)*aSeat.y,0.,sin(t*.22)*aSeat.y)
                  : vec3(sin(t*.7)*3.+sin(t*.31+1.7)*4.,0.,cos(t*.53)*3.+cos(t*.27+.6)*4.);
}
void main(){
  float t=uTime*aSeed.y+aSeed.x*50.;
  vec2 home=aSeat.xz;
  if(uBird<.5){ vec2 rel=mod(home-uFocus.xz+uTile*.5,uTile)-uTile*.5; home=uFocus.xz+rel; }
  vec3 here=trail(t), next=trail(t+.15);
  vec3 c=vec3(home.x,0.,home.y)+here;
  float ground=texture2D(uHeightTex,(c.xz+uHalf)/(2.*uHalf)).r;
  c.y=uBird>.5 ? aSeat.y*.0+aSeed.z*18.+34.+sin(t*.4)*3. : ground+1.+sin(t*1.3)*.5+aSeed.z;
  vec3 f=normalize(vec3(next.x-here.x,0.,next.z-here.z)+vec3(1e-4,0.,0.)), r=vec3(f.z,0.,-f.x);
  // wings beat about the body: butterflies fast, birds slow with a glide between beats
  float beat=uBird>.5 ? sin(uTime*5.+aSeed.x*30.)*.7*smoothstep(-.2,.6,sin(uTime*.9+aSeed.x*9.)) : sin(uTime*(14.+aSeed.x*6.)+aSeed.x*30.)*1.05;
  vec3 p=position*aSeed.w;
  float span=abs(p.x);
  vec3 wp=c+r*(sign(p.x)*span*cos(beat))+vec3(0.,span*sin(beat),0.)+f*p.z;
  vHue=aSeed.x; vShade=.55+.45*span/max(aSeed.w,.001); vP=wp;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
}`;

const WING_FRAG = /* glsl */ `
uniform float uBird;
varying float vHue; varying float vShade; varying vec3 vP;
${COMMON}
void main(){
  // butterflies carry their own soft light, in four colours; birds are dark shapes against the sky
  float pick=fract(vHue*7.3)*4.;
  vec3 wing=pick<1.?vec3(1.,.55,.75):pick<2.?vec3(.55,.85,1.):pick<3.?vec3(1.,.85,.45):vec3(.75,.6,1.);
  vec3 c=uBird>.5 ? vec3(.05,.035,.09)+vec3(.5,.2,.1)*pow(max(dot(normalize(vP-cameraPosition),uSun),0.),6.)*.3 : wing*vShade*1.25;
  gl_FragColor=vec4(applyFog(c,vP),1.);
}`;

function wings(scene, land, count, bird, tile, R, seat) {
  const geo = new THREE.InstancedBufferGeometry();
  // two triangles, one each side of the body line
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.32, 0, 0, -0.3, -1, 0, 0.12, 0, 0, 0.32, 1, 0, 0.12, 0, 0, -0.3], 3));
  const seats = new Float32Array(count * 3), seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { const s = seat(i); seats.set(s, i * 3); seeds.set([R(), 0.7 + R() * 0.6, R(), bird ? 1.5 + R() * 0.7 : 0.34 + R() * 0.2], i * 4); }
  geo.setAttribute('aSeat', new THREE.InstancedBufferAttribute(seats, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  const mesh = new THREE.Mesh(geo, shaderMaterial(WING_VERT, WING_FRAG, { ...land, uTile: { value: tile }, uBird: { value: bird ? 1 : 0 } }, { side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.userData.part = 'life'; // bench part name
  scene.add(mesh);
  return mesh;
}

/** o: { scene, world, low, burst(p, color, n, speed, up), sfx }. */
export function createLife(o) {
  const { scene, world } = o, L = LIFE, R = rng(808), H = world.terrain.heightAt, land = world.terrain.uniforms, lake = world.lake;
  const tier = o.low ? 1 : 0;
  wings(scene, land, L.butterflies[tier], false, L.butterflyTile, R, () => [R() * L.butterflyTile, 0, R() * L.butterflyTile]);
  // birds: seat = centre x, circle radius, centre z
  wings(scene, land, L.birds, true, 0, R, (i) => (i % 2 ? [40 + R() * 20, 55 + R() * 40, -50 + R() * 20] : [-20 + R() * 20, 45 + R() * 35, 10 + R() * 20]));

  // ---- Fluffs: a round furry body, two ears, two eyes; they hop, and they are shy ----
  const fluffGeo = merge([
    place(tint(blob(5, 0.07, 2, 2), '#fff1e0', 0, (c, _x, y) => c.lerp(new THREE.Color('#ffc9d8'), Math.max(-y, 0) * 0.6)), 0, 0.5, 0, 0, 0, 0, 0.52, 0.47, 0.5),
    ...[-1, 1].flatMap((sd) => [
      place(tint(new THREE.ConeGeometry(0.12, 0.42, 6), '#fff1e0'), sd * 0.2, 1.05, -0.02, 0, 0, -sd * 0.25),
      place(tint(new THREE.SphereGeometry(0.07, 8, 6), '#241830'), sd * 0.19, 0.6, 0.44),
    ]),
    place(tint(new THREE.SphereGeometry(0.13, 8, 6), '#ffffff'), 0, 0.38, -0.5),
  ]);
  const fluffMesh = new THREE.InstancedMesh(fluffGeo, softMaterial({ fuzz: 1, leaf: 3.2 }), L.fluffs);
  fluffMesh.frustumCulled = false;
  fluffMesh.userData.part = 'life'; // bench part name
  scene.add(fluffMesh);
  const fluffs = [];
  for (let tries = 0; fluffs.length < L.fluffs && tries < 900; tries++) {
    const x = (R() * 2 - 1) * 95, z = (R() * 2 - 1) * 95, m = world.terrain.maskAt(x, z);
    if (m.wet + m.sand > 0.05 || Math.hypot(x, z) < 9) continue;
    fluffs.push({ home: V3(x, 0, z), from: V3(x, 0, z), to: V3(x, 0, z), f: 1, wait: R() * 3, yaw: R() * 6, size: 0.8 + R() * 0.5, span: 0.45, scared: false });
  }
  fluffMesh.count = fluffs.length;

  // ---- Fish: a few glossy shapes that arc out of the lake ----
  const fishGeo = merge([
    place(tint(blob(9, 0.05, 2, 2), '#8fe6e0', 0, (c, _x, y) => c.lerp(new THREE.Color('#fff6e0'), Math.max(-y, 0) * 0.8)), 0, 0, 0, 0, 0, 0, 0.3, 0.36, 0.85),
    place(tint(new THREE.ConeGeometry(0.34, 0.6, 4), '#63c9d4'), 0, 0, -1.05, -Math.PI / 2, 0, 0, 1, 1, 0.35),
  ]);
  const fish = [0, 1, 2].map(() => { const m = new THREE.Mesh(fishGeo, softMaterial({ fuzz: 0, gloss: 0.9 })); m.visible = false; m.userData.part = 'life'; scene.add(m); return { m, f: 1, from: V3(), dir: V3(), reach: 4 }; });
  let fishIn = 2;

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = V3(), p = V3();
  return {
    update(dt, time, lead) {
      fluffs.forEach((fl, i) => {
        const dx = fl.to.x - lead.x, dz = fl.to.z - lead.z, gap = Math.hypot(dx, dz);
        fl.scared = fl.scared ? gap < L.fluffCalm : gap < L.fluffScare && Math.abs(lead.y - H(fl.to.x, fl.to.z)) < 8;
        if (fl.f >= 1) {
          fl.wait -= dt;
          if (fl.scared || fl.wait <= 0) {
            // next hop: away from you if scared, otherwise somewhere near home
            fl.from.copy(fl.to);
            const ang = fl.scared ? Math.atan2(dx, dz) + (R() - 0.5) * 0.9 : R() * 6.283, far = fl.scared ? 4.2 : 1 + R() * 2;
            p.set(fl.from.x + Math.sin(ang) * far, 0, fl.from.z + Math.cos(ang) * far);
            if (!fl.scared && p.distanceTo(fl.home) > 7) p.copy(fl.home);
            const mask = world.terrain.maskAt(p.x, p.z);
            if (mask.wet < 0.05) { fl.to.copy(p); fl.yaw = Math.atan2(fl.to.x - fl.from.x, fl.to.z - fl.from.z); fl.f = 0; fl.span = fl.scared ? 0.3 : 0.5; }
            fl.wait = fl.scared ? 0 : 1 + R() * 3;
          }
        } else fl.f = Math.min(fl.f + dt / fl.span, 1);
        const x = fl.from.x + (fl.to.x - fl.from.x) * fl.f, z = fl.from.z + (fl.to.z - fl.from.z) * fl.f, arc = Math.sin(fl.f * Math.PI);
        const land2 = fl.f >= 1 ? Math.exp(-Math.max(1 - fl.wait, 0) * 0) : 1, squat = 1 - (fl.f < 0.12 || fl.f > 0.9 ? 0.16 : 0) + arc * 0.14;
        m4.compose(p.set(x, H(x, z) + arc * (fl.scared ? 1 : 0.6) * fl.size, z), q.setFromEuler(e.set(0, fl.yaw, 0)), s.set(fl.size / Math.sqrt(squat), fl.size * squat * land2, fl.size / Math.sqrt(squat)));
        fluffMesh.setMatrixAt(i, m4);
      });
      fluffMesh.instanceMatrix.needsUpdate = true;

      fishIn -= dt;
      if (fishIn <= 0) {
        fishIn = L.fishEvery[0] + R() * (L.fishEvery[1] - L.fishEvery[0]);
        const idle = fish.find((fi) => fi.f >= 1);
        if (idle) {
          const ang = R() * 6.283, rad = Math.sqrt(R()) * lake.r * 0.7, heading = R() * 6.283;
          idle.from.set(lake.x + Math.cos(ang) * rad, lake.y, lake.z + Math.sin(ang) * rad);
          idle.dir.set(Math.sin(heading), 0, Math.cos(heading)); idle.reach = 3 + R() * 2.5; idle.f = 0;
          o.burst(idle.from, '#dff2ff', 10, 5, 5);
          if (Math.hypot(lead.x - idle.from.x, lead.z - idle.from.z) < 45) o.sfx.slosh?.();
        }
      }
      for (const fi of fish) {
        if (fi.f >= 1) { fi.m.visible = false; continue; }
        const before = fi.f;
        fi.f = Math.min(fi.f + dt / 1.05, 1);
        const arc = Math.sin(fi.f * Math.PI);
        fi.m.visible = true;
        fi.m.position.copy(fi.from).addScaledVector(fi.dir, fi.reach * fi.f).setY(lake.y - 0.3 + arc * L.fishHeight);
        fi.m.rotation.set(-Math.cos(fi.f * Math.PI) * 1.1, Math.atan2(fi.dir.x, fi.dir.z), 0, 'YXZ');
        if (before < 1 && fi.f >= 1) o.burst(fi.m.position, '#dff2ff', 8, 4, 4);
      }
    },
  };
}
