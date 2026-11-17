// Moving light and water: drifting motes, the pond, the stream and its waterfall.
import * as THREE from 'three';
import { COMMON, NOISE, shaderMaterial } from './glsl.js';
import { V3, rng } from './util.js';

const MOTE_VERT = /* glsl */ `
attribute vec4 aA; // phase, rise speed, rise range, size
attribute vec4 aB; // r, g, b, alpha
uniform float uPx; uniform float uAmount;
varying vec4 vC;
${COMMON}
void main(){
  vec3 p=position;
  float cyc=aA.z>0. ? fract(uTime*aA.y/max(aA.z,.001)+aA.x) : 0.5;
  p.y+=cyc*aA.z;
  p.x+=sin(uTime*.5+aA.x*40.)*(.4+aA.z*.05);
  p.z+=cos(uTime*.37+aA.x*61.)*(.4+aA.z*.05);
  vec4 mv=viewMatrix*modelMatrix*vec4(p,1.);
  float life=aA.z>0. ? sin(cyc*3.14159) : 1.;
  float tw=.55+.45*sin(uTime*(1.5+aA.x*3.)+aA.x*90.);
  float keep=step(fract(aA.x*7.31),uAmount);
  // a mote drifting right past the lens would fill the screen as one bright square: fade it out up close
  float close=smoothstep(2.,7.,-mv.z);
  vC=vec4(aB.rgb,aB.a*life*tw*keep*close*exp(length(mv.xyz)*-uFog*.6));
  gl_PointSize=min(aA.w*uPx/max(-mv.z,.1),140.);
  gl_Position=projectionMatrix*mv;
}`;

const MOTE_FRAG = /* glsl */ `
varying vec4 vC;
void main(){
  float d=length(gl_PointCoord-.5)*2.;
  float a=smoothstep(1.,0.,d); a=a*a+smoothstep(.35,0.,d)*.8;
  gl_FragColor=vec4(vC.rgb*vC.a*a,1.);
}`;

/** Collects glowing points, then builds one draw call. */
export class Motes {
  constructor(seed) { this.R = rng(seed); this.pos = []; this.a = []; this.b = []; }

  /** o: { at:[x,y,z], spread:[x,y,z], n, rise, range, size, color, alpha } */
  add(o) {
    const c = new THREE.Color(o.color), R = this.R;
    for (let i = 0; i < o.n; i++) {
      this.pos.push(o.at[0] + (R() * 2 - 1) * o.spread[0], o.at[1] + (R() * 2 - 1) * o.spread[1], o.at[2] + (R() * 2 - 1) * o.spread[2]);
      this.a.push(R(), o.rise ?? 0.3, o.range ?? 0, o.size * (0.6 + R() * 0.8));
      this.b.push(c.r, c.g, c.b, o.alpha ?? 1);
    }
  }

  /** One point at an exact place (a blossom on the grass). */
  one(x, y, z, size, color, alpha = 1) {
    const c = new THREE.Color(color);
    this.pos.push(x, y, z); this.a.push(this.R(), 0, 0, size); this.b.push(c.r, c.g, c.b, alpha);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('aA', new THREE.Float32BufferAttribute(this.a, 4));
    g.setAttribute('aB', new THREE.Float32BufferAttribute(this.b, 4));
    this.material = shaderMaterial(MOTE_VERT, MOTE_FRAG, { uPx: { value: 600 }, uAmount: { value: 1 } },
      { blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const pts = new THREE.Points(g, this.material);
    pts.frustumCulled = false;
    return pts;
  }
}

const WATER_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vP;
void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`;

const POND_FRAG = /* glsl */ `
varying vec2 vUv; varying vec3 vP;
uniform sampler2D uHeightTex; uniform float uHalf; uniform float uShore;
${COMMON}
${NOISE}
void main(){
  // how deep the water is here: surface height minus the ground under it
  float depth=uShore>.5 ? vP.y-texture2D(uHeightTex,(vP.xz+uHalf)/(2.*uHalf)).r : 3.;
  vec3 v=normalize(cameraPosition-vP);
  vec2 q=vP.xz*1.4;
  vec3 n=normalize(vec3(vnoise(q+uTime*.35)-.5,3.5,vnoise(q.yx-uTime*.3)-.5));
  vec3 refl=skyBase(normalize(reflect(-v,n)*vec3(1.,1.,1.)+vec3(0.,.08,0.)));
  float fres=pow(clamp(1.-dot(n,v),0.,1.),2.5);
  // jelly-clear shallows over the sand, deep teal further out
  vec3 body=mix(vec3(.1,.5,.46),vec3(.02,.13,.2),smoothstep(.2,3.2,depth));
  vec3 c=mix(body,refl*1.5,(.3+.6*fres)*smoothstep(.1,1.6,depth)+.12);
  for(int i=0;i<4;i++){ vec3 L=uLP[i].xyz-vP; float a=clamp(1.-length(L)/uLP[i].w,0.,1.); c+=uLC[i]*a*a*.12; }
  float spark=smoothstep(.93,1.,vnoise(q*5.+uTime*.8))*fres;
  c+=vec3(1.5,1.,.7)*spark;
  // foam where the water meets the shore: a wobbling bright line, then two fading ripples
  float wob=(vnoise(q*1.3+uTime*.25)-.5)*.35;
  float foam=1.-smoothstep(.06,.34,depth+wob);
  foam+=(1.-smoothstep(.0,.12,abs(fract(depth*1.1-uTime*.22+wob)-.5)-.38))*(1.-smoothstep(.4,2.,depth))*.45;
  c=mix(c,vec3(1.15,1.08,1.),clamp(foam,0.,1.)*.85*uShore);
  float edge=1.-smoothstep(.86,1.,length(vUv*2.-1.));
  edge*=mix(1.,smoothstep(0.,.07,depth),uShore);
  gl_FragColor=vec4(applyFog(c,vP),edge);
}`;

const FALL_FRAG = /* glsl */ `
varying vec2 vUv; varying vec3 vP;
uniform float uEdge; uniform float uLen; uniform float uFadeFrom;
${COMMON}
${NOISE}
void main(){
  float fall=smoothstep(uEdge-.5,uEdge+2.5,vUv.y);
  float speed=mix(1.3,6.,fall);
  float n=vnoise(vec2(vUv.x*5.,vUv.y*.7-uTime*speed));
  float n2=vnoise(vec2(vUv.x*15.,vUv.y*1.8-uTime*speed*1.6));
  float streak=n*.6+n2*.4;
  vec3 v=normalize(cameraPosition-vP);
  vec3 sky=skyBase(normalize(vec3(-v.x,.25,-v.z)));
  vec3 calm=mix(vec3(.03,.13,.17),sky,.45)+vec3(1.,.9,.8)*smoothstep(.7,.95,streak)*.35;
  vec3 foam=mix(vec3(.3,.42,.6),vec3(1.25,.95,.85),streak)*(.7+.5*streak);
  foam+=vec3(1.3,.6,.3)*pow(max(dot(-v,uSun),0.),3.)*.5;
  vec3 c=mix(calm,foam,fall);
  float side=smoothstep(0.,.22,vUv.x)*smoothstep(1.,.78,vUv.x);
  float a=side*mix(.85,.35+.6*streak,fall)*(1.-smoothstep(uLen*uFadeFrom,uLen,vUv.y));
  gl_FragColor=vec4(applyFog(c,vP),a);
}`;

/** land: the terrain's uniforms; pass them to get a real shoreline (depth tint and foam). */
export function makePond(x, y, z, radius, land) {
  const extra = land ? { uHeightTex: land.uHeightTex, uHalf: land.uHalf, uShore: { value: 1 } } : { uHeightTex: { value: null }, uHalf: { value: 1 }, uShore: { value: 0 } };
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), shaderMaterial(WATER_VERT, POND_FRAG, extra, { transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 1;
  return m;
}

/**
 * A ribbon of water along world points; from index edgeIndex on it is falling.
 * widths: (f) => half width at fraction f.
 */
export function makeStream(points, edgeIndex, width, fadeFrom = 0.55) {
  const pos = [], uv = [], idx = [], side = V3(), tan = V3(), up = V3(0, 1, 0);
  let len = 0, edgeLen = 0;
  points.forEach((p, i) => {
    if (i) len += p.distanceTo(points[i - 1]);
    if (i === edgeIndex) edgeLen = len;
    tan.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]);
    tan.y = 0;
    if (tan.lengthSq() < 1e-6) tan.set(0, 0, 1);
    side.crossVectors(tan.normalize(), up).normalize();
    const w = width(i / (points.length - 1));
    pos.push(p.x + side.x * w, p.y, p.z + side.z * w, p.x - side.x * w, p.y, p.z - side.z * w);
    uv.push(0, len, 1, len);
    if (i < points.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, shaderMaterial(WATER_VERT, FALL_FRAG, { uEdge: { value: edgeLen }, uLen: { value: len }, uFadeFrom: { value: fadeFrom } },
    { transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 2;
  m.frustumCulled = false;
  return m;
}
