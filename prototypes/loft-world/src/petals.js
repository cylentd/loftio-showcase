// Cherry petals: small folded petals tumbling down from the cherry crowns, and a litter of them on the ground below.
// Lit by the shared shade() like everything else; motion is all in the vertex shader from the shared clock (G.uTime).
import * as THREE from 'three';
import { COMMON, shaderMaterial } from './glsl.js';
import { LAND } from './terrain.js';
import { petalSeeds, fallenSpots, petalBudget } from './petals-model.mjs';
import { PETAL_FALL, PETAL_GROUND, PETAL_LOOK, PETAL_WIND_DIR, PETAL_SEED } from './petals-data.mjs';

const ROT = /* glsl */ `
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
uniform vec2 uFade; uniform float uTintSpread;
attribute float aBase;
varying vec3 vN; varying vec3 vP; varying float vTint; varying float vBase;
float farKeep(vec3 p){ return 1.-smoothstep(uFade.x,uFade.y,distance(p,cameraPosition)); }
`;

const FALL_VERT = /* glsl */ `
attribute vec3 aStart; attribute vec4 aSeed; attribute float aTint; // aSeed: phase 0..1, fall speed, sway reach, drop
uniform vec2 uDrift; uniform vec3 uFall; uniform vec2 uSpin; // uFall: sway rate, grow seconds, shrink drop
${COMMON}
${ROT}
void main(){
  float phase=aSeed.x, speed=aSeed.y, drop=aSeed.w, life=drop/speed;
  float t=mod(uTime+phase*life,life), fallen=t*speed;
  float h1=fract(phase*91.7), h2=fract(phase*47.3);
  vec2 wind=uDrift*uWind, side=vec2(-sin(${PETAL_WIND_DIR.toFixed(4)}),cos(${PETAL_WIND_DIR.toFixed(4)}));
  float sw=sin(t*uFall.x+phase*6.2832);
  vec3 centre=aStart+vec3(wind.x*t,-fallen,wind.y*t)+vec3(side.x,0.,side.y)*sw*aSeed.z;
  // tumble about two axes, and rock with the flutter so the petal swings like a leaf rather than spinning like a coin
  mat3 R=rotY(phase*6.2832+sw*.7)*rotX(uTime*mix(uSpin.x,uSpin.y,h1)+h1*6.2832)*rotZ(uTime*mix(uSpin.x,uSpin.y,h2)*.6+h2*6.2832);
  float grow=smoothstep(0.,uFall.y,t)*(1.-smoothstep(drop-uFall.z,drop,fallen));
  vec3 wp=centre+R*position*grow*farKeep(centre);
  vN=R*normal; vP=wp; vTint=aTint*uTintSpread; vBase=aBase;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
}`;

const REST_VERT = /* glsl */ `
attribute vec3 aPos; attribute vec3 aRest; // aRest: yaw, tilt, tint
${COMMON}
${ROT}
void main(){
  mat3 R=rotY(aRest.x)*rotX(aRest.y);
  vec3 wp=aPos+R*position*farKeep(aPos);
  vN=R*normal; vP=wp; vTint=aRest.z*uTintSpread; vBase=aBase;
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
}`;

const FRAG = /* glsl */ `
uniform vec3 uTip; uniform vec3 uBaseCol; uniform vec3 uWhite; uniform float uBack;
varying vec3 vN; varying vec3 vP; varying float vTint; varying float vBase;
${COMMON}
void main(){
  vec3 v=normalize(cameraPosition-vP);
  vec3 n=normalize(vN); if(!gl_FrontFacing) n=-n;
  vec3 alb=mix(mix(uTip,uWhite,vTint),uBaseCol,vBase);
  vec3 c=shade(alb,n,vP,v);
  // a petal is thin: some of the sun and moon on its far side shows through
  c+=alb*(uSunCol*max(dot(-n,uSun),0.)+uMoonCol*max(dot(-n,uMoon),0.)*.5)*uBack*shadowAt(vP,-n);
  gl_FragColor=vec4(clamp(applyFog(c,vP),0.,40.),1.);
}`;

/** One petal lying in the ground plane: a fan from the middle of the midrib to the outline, its edges lifted into a cup. */
function petalShape() {
  const { length: L, width: W, fold, outline } = PETAL_LOOK, half = W / 2;
  const ring = [...outline, ...outline.slice(1, -1).reverse().map(([x, z]) => [-x, z])]; // right half base to tip, then left half back down
  const pos = [0, 0, 0], base = [0];
  for (const [x, z] of ring) { pos.push(x * half, fold * Math.abs(x), z * L); base.push(Math.max(0, -z * 2)); } // deeper colour toward the base
  const index = ring.flatMap((_, i) => [0, i + 1, ((i + 1) % ring.length) + 1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aBase', new THREE.Float32BufferAttribute(base, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function instanced(count, attrs) {
  const g = new THREE.InstancedBufferGeometry().copy(petalShape());
  for (const [name, [array, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(array, size));
  g.instanceCount = count;
  return g;
}

function material(vert, extra) {
  const look = { uTip: { value: new THREE.Vector3(...PETAL_LOOK.tip) }, uBaseCol: { value: new THREE.Vector3(...PETAL_LOOK.base) }, uWhite: { value: new THREE.Vector3(...PETAL_LOOK.white) },
    uBack: { value: PETAL_LOOK.backLight }, uTintSpread: { value: PETAL_LOOK.tintSpread }, uFade: { value: new THREE.Vector2(PETAL_LOOK.fadeNear, PETAL_LOOK.fadeFar) } };
  return shaderMaterial(vert, FRAG, { ...look, ...extra }, { side: THREE.DoubleSide });
}

function fallingMesh(spots, perTree) {
  const s = petalSeeds(spots, perTree, PETAL_SEED.falling), n = s.phase.length, seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) seed.set([s.phase[i], s.speed[i], s.sway[i], s.drop[i]], i * 4);
  const mat = material(FALL_VERT, {
    uDrift: { value: new THREE.Vector2(Math.cos(PETAL_WIND_DIR), Math.sin(PETAL_WIND_DIR)).multiplyScalar(PETAL_FALL.drift) },
    uFall: { value: new THREE.Vector3(PETAL_FALL.swayRate, PETAL_FALL.growSeconds, PETAL_FALL.shrinkDrop) },
    uSpin: { value: new THREE.Vector2(...PETAL_FALL.spin) },
  });
  return new THREE.Mesh(instanced(n, { aStart: [s.start, 3], aSeed: [seed, 4], aTint: [s.tint, 1] }), mat);
}

function fallenMesh(spots, perTree, terrain) {
  const lift = (x, z) => { const m = terrain.maskAt(x, z); return PETAL_GROUND.grassLift * (1 - Math.max(m.path, m.sand)); }; // grass is what is neither path nor sand
  const f = fallenSpots(spots, perTree, terrain.heightAt, PETAL_SEED.fallen, { water: LAND.water, lift });
  const n = f.yaw.length, rest = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) rest.set([f.yaw[i], f.tilt[i], f.tint[i]], i * 3);
  return new THREE.Mesh(instanced(n, { aPos: [f.pos, 3], aRest: [rest, 3] }), material(REST_VERT, {}));
}

/** Both petal meshes for the world's cherry trees, at the mode's budget. Hide the group during the shadow pass. */
export function createPetals(world, modeName) {
  const group = new THREE.Group(), budget = petalBudget(modeName);
  group.name = 'petals'; group.userData.part = 'petals'; // bench part name
  if (budget.falling > 0) group.add(fallingMesh(world.cherrySpots, budget.falling));
  if (budget.fallen > 0) group.add(fallenMesh(world.cherrySpots, budget.fallen, world.terrain));
  group.children.forEach((mesh) => { mesh.frustumCulled = false; }); // positions live in the shader, so the geometry's bounds mean nothing
  group.userData.counts = group.children.map((mesh) => mesh.geometry.instanceCount);
  return group;
}
