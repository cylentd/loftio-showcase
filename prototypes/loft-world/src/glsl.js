// One lighting model, one sky and one fog shared by every material, so the scene reads as one place.
import * as THREE from 'three';
import {LOOK} from './terrain-look-data.mjs';
import {LAMP_MAP} from './lamp-map-data.mjs';
import { DAY_UNIFORMS, DAY_KEYS } from './day-data.mjs';

// One uniform per time-of-day value (table in day-data.mjs), started at dusk; day-view.js rewrites them every frame.
const dayUniform = (key, [, type]) => {
  const raw = DAY_KEYS.dusk[key];
  if (type !== 'vec3') return { value: raw };
  const v = new THREE.Vector3(...raw);
  return { value: key.endsWith('Dir') ? v.normalize() : v };
};
const DAY_G = Object.fromEntries(Object.entries(DAY_UNIFORMS).map(([key, def]) => [def[0], dayUniform(key, def)]));
const DAY_DECLS = Object.values(DAY_UNIFORMS).map(([name, type]) => `uniform ${type} ${name};`).join(' ');

/** Shared uniforms: every material holds these same objects, so one write updates the world. */
export const G = {
  ...DAY_G,
  uTime: { value: 0 },
  uShadowDir: { value: new THREE.Vector3(0, 1, 0) }, // direction of the light that casts shadows now (JS only: the shadow camera and the resident shadows)
  uShadowStrength: { value: 1 }, // 0..1, fades to 0 around the sun and moon handover
  uCasterMoon: { value: 1 }, // 1 when the moon casts the shadows, 0 for the sun
  uLampBase: { value: 0 }, // the baked pool gain (0 under ?lamps=off); uLampGain is this times the day's lamp multiplier
  uLP: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -999, 0, 1)) },
  uLC: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
  uFog: { value: 0.0065 },
  uWind: { value: 1 },
  uGlow: { value: LOOK.emission },
  uViewEye: { value: new THREE.Vector3() },
  // one shadow map, cast from the moon key light and centred on the player
  uShadowMap: { value: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) },
  uShadowMat: { value: new THREE.Matrix4() },
  uShadowOn: { value: 0 },
  uShadowTexel: { value: 1 / 2048 },
  // baked path-lamp light (see lamp-map.mjs): RGB warm light, A ground height of the lamp; world.js replaces the empty map
  uLampMap: { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) },
  uLampBox: { value: new THREE.Vector4(0, 0, 1, 0) }, // x, z of the map's corner, its width in world units, unused
  uLampY: { value: new THREE.Vector2(0, 1) }, // lowest lamp ground height, and the span up to the highest
  uLampFade: { value: new THREE.Vector2(LAMP_MAP.fadeNear, LAMP_MAP.fadeFar) },
  uLampGain: { value: 0 }, // 0 until the map is baked; `?lamps=off` keeps it 0
};
G.uShadowMap.value.needsUpdate = true;
G.uLampMap.value.needsUpdate = true;

export const NOISE = /* glsl */ `
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float hash31(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.3,9.1);a*=.5;}return s;}
`;

export const COMMON = /* glsl */ `
uniform float uTime; ${DAY_DECLS}
uniform float uShadowStrength; uniform float uCasterMoon;
uniform vec4 uLP[4]; uniform vec3 uLC[4];
uniform float uFog; uniform float uWind; uniform float uGlow;
uniform sampler2D uShadowMap; uniform mat4 uShadowMat; uniform float uShadowOn; uniform float uShadowTexel;
uniform sampler2D uLampMap; uniform vec4 uLampBox; uniform vec2 uLampY; uniform vec2 uLampFade; uniform float uLampGain;

// Warm pools from the path lamps: one fetch of the baked map, faded out above and below the lamp's own ground.
vec3 lampLight(vec3 p){
  vec4 t=texture2D(uLampMap,(p.xz-uLampBox.xy)/uLampBox.z);
  float gy=uLampY.x+t.a*uLampY.y;
  return t.rgb*(1.-smoothstep(uLampFade.x,uLampFade.y,abs(p.y-gy)));
}

// 1 = lit, 0 = in shadow. Four soft taps; fades out at the edge of the shadow map.
float shadowAt(vec3 p, vec3 n){
  if(uShadowOn<.5) return 1.;
  vec4 sc=uShadowMat*vec4(p+n*.15,1.);
  vec3 s=sc.xyz/sc.w;
  if(s.x<0.||s.x>1.||s.y<0.||s.y>1.||s.z>1.) return 1.;
  float lit=0.;
  for(int row=-1;row<=1;row++)for(int column=-1;column<=1;column++){
    lit+=step(s.z-.0012,texture2D(uShadowMap,s.xy+vec2(float(column),float(row))*uShadowTexel*1.6).r);
  }
  float edge=smoothstep(0.,.08,min(min(s.x,1.-s.x),min(s.y,1.-s.y)));
  return mix(1.,mix(1.,.22+lit/9.*.78,uShadowStrength),edge);
}

// Dusk sky: indigo zenith, violet middle, rose low band, amber glow where the sun went down.
vec3 skyBase(vec3 d){
  float y=d.y;
  float az=clamp(dot(normalize(d.xz+vec2(1e-4)),normalize(uSun.xz))*.5+.5,0.,1.);
  vec3 zen=uSkyZen, mid=uSkyMid, low=uSkyLow, hor=uSkyHor;
  vec3 c=mix(mid,zen,smoothstep(.1,.6,y));
  // away from the sun the low sky stays cool teal-blue; toward it, rose
  c=mix(mix(uSkyAway,low,pow(az,1.6)),c,smoothstep(-.02,.26,y));
  float hg=exp(-max(y,0.)*10.)*pow(az,3.5);
  c=mix(c,hor,clamp(hg,0.,1.)*.92);
  c+=uSkyGlow*exp(-max(y,0.)*4.)*pow(az,6.)*.3;
  return c;
}
// Fog takes a dimmed sky colour at the horizon in the view direction, so far things melt into the sky.
vec3 fogCol(vec3 ray){ return skyBase(normalize(vec3(ray.x,max(ray.y,0.)*.25+.06,ray.z)))*uFogScale; }
vec3 applyFog(vec3 c, vec3 p){
  vec3 ray=p-cameraPosition; float d=length(ray);
  float valley=1.-smoothstep(0.,18.,(p.y+cameraPosition.y)*.5);
  float f=1.-exp(-max(d-24.,0.)*uFog*(1.+valley*.65));
  return mix(c,fogCol(ray/d),f);
}
// Cool moon key from the front, warm low sun from behind, sky and ground fill, four small warm lamps.
vec3 shade(vec3 alb, vec3 n, vec3 p, vec3 v){
  float up=n.y*.5+.5;
  vec3 amb=mix(uAmbLo,uAmbHi,up);
  vec3 moon=uMoonCol*pow(max(dot(n,uMoon)*.6+.4,0.),1.3);
  float sd=dot(n,uSun);
  vec3 sun=uSunCol*smoothstep(-.1,.9,sd);
  float sh=shadowAt(p,n);
  // slow patches of warm light and cool shade drift across everything, as if clouds were passing
  vec2 cq=p.xz*.021+vec2(uTime*.011,uTime*.004);
  float drift=sin(cq.x*2.1+sin(cq.y*1.7))*.5+sin(cq.y*2.9-cq.x*1.3)*.5;
  float warm=smoothstep(-.35,.6,drift);
  // the caster's own light takes the full shadow, the other light and the sky only half
  float shM=mix(.5+.5*sh,sh,uCasterMoon), shS=mix(sh,.5+.5*sh,uCasterMoon);
  vec3 c=alb*(amb*(.5+.5*sh)+moon*shM*(.75+.25*warm)+sun*shS*(.45+.85*warm));
  float rim=pow(clamp(1.-dot(n,v),0.,1.),2.5)*smoothstep(-.6,.4,sd);
  c+=(alb*.7+.06)*vec3(.65,.6,.7)*rim*(.5+.5*warm);
  for(int i=0;i<4;i++){
    vec3 L=uLP[i].xyz-p; float d=length(L);
    float a=clamp(1.-d/uLP[i].w,0.,1.); a*=a;
    c+=alb*uLC[i]*a*(max(dot(n,L/d),0.)*.7+.3);
  }
  if(uLampGain>0.) c+=alb*lampLight(p)*uLampGain;
  return c;
}
`;

const SOFT_VERT = /* glsl */ `
attribute vec3 aCol; attribute float aGlow;
uniform float uSway; uniform vec3 uCrownCenter;
uniform float uDetailRange; uniform vec3 uViewEye;
varying vec3 vCol; varying vec3 vN; varying vec3 vP; varying float vGlow; varying vec3 vCC;
${COMMON}
void main(){
  vec4 wp=vec4(position,1.); vec3 n=normal;
  #ifdef USE_INSTANCING
    wp=instanceMatrix*wp; n=mat3(instanceMatrix)*n;
  #endif
  wp=modelMatrix*wp; n=normalize(mat3(modelMatrix)*n);
  if(uDetailRange>0.){
    vec4 root=vec4(0.,0.,0.,1.);
    #ifdef USE_INSTANCING
      root=instanceMatrix*root;
    #endif
    root=modelMatrix*root;
    float keep=1.-smoothstep(uDetailRange*.7,uDetailRange,distance(root.xyz,uViewEye));
    wp.xyz=mix(root.xyz,wp.xyz,keep);
  }
  if(uSway>0.){
    // one phase per object and a sideways lean that grows with height: the crown sways as a whole and never swells or shrinks
    vec4 so=vec4(0.,0.,0.,1.);
    #ifdef USE_INSTANCING
      so=instanceMatrix*so;
    #endif
    so=modelMatrix*so;
    float w=sin(uTime*1.1+so.x*.35+so.z*.27)+.5*sin(uTime*2.3+so.x*.9+so.z*.7);
    wp.xz+=vec2(.12,.09)*w*clamp((wp.y-so.y)*.12,0.,1.5)*uSway*uWind;
  }
  vec4 cc=vec4(uCrownCenter,1.);
  #ifdef USE_INSTANCING
    cc=instanceMatrix*cc;
  #endif
  vCC=(modelMatrix*cc).xyz;
  vP=wp.xyz; vN=n; vCol=aCol; vGlow=aGlow;
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const SOFT_FRAG = /* glsl */ `
varying vec3 vCol; varying vec3 vN; varying vec3 vP; varying float vGlow; varying vec3 vCC;
uniform float uCrownSoft; uniform float uCrownRim;
uniform float uOpacity; uniform float uImpactTint; uniform float uFlicker; uniform float uLeaf; uniform float uFuzz; uniform float uGloss;
${COMMON}
${NOISE}
void main(){
  vec3 v=normalize(cameraPosition-vP);
  vec3 n=dot(vN,vN)>1e-8 ? normalize(vN) : vec3(0.,1.,0.); if(!gl_FrontFacing) n=-n;
  vec3 alb=vCol*(1.-uImpactTint);
  // crowns: lean the normal toward straight out from the crown centre so the crown is lit as one soft mass
  if(uCrownSoft>0.) n=normalize(mix(n,normalize(vP-vCC),uCrownSoft));
  if(uLeaf>0.){
    // leaf clumps: break the smooth ball into small lit and shaded tufts
    vec3 q=vP*uLeaf;
    vec3 j=vec3(vnoise(q.xy+q.z*.7),vnoise(q.yz+q.x*.7+9.),vnoise(q.zx+q.y*.7+21.))-.5;
    float detail=1.-smoothstep(30.,100.,distance(cameraPosition,vP));
    n=normalize(n+j*.18*detail);
    float tuft=vnoise(q.xz*2.6+q.y*2.1)*.6+vnoise(q.zy*6.+q.x*5.)*.4;
    alb*=1.+(tuft-.5)*.18*detail;
  }
  float ndv=clamp(dot(n,v),0.,1.);
  // flocked, felt-like surfaces: a fine fibre grain, and a soft halo of sky light at grazing angles
  if(uFuzz>0.){ float grain=vnoise(vP.xz*11.+vP.y*8.)*.5+vnoise(vP.zy*27.+vP.x*19.)*.5; alb*=1.+uFuzz*(grain-.5)*.5; }
  vec3 c=shade(alb,n,vP,v);
  if(uFuzz>0.) c+=(alb*.8+.03)*vec3(.5,.56,.95)*pow(1.-ndv,2.2)*uFuzz*.7;
  // felted crown rim: a soft pale lift toward the silhouette, matte (no highlight)
  if(uCrownRim>0.) c+=(alb*.6+.04)*vec3(.7,.72,.6)*pow(1.-ndv,2.)*uCrownRim;
  // glazed ceramic and vinyl: a tight highlight from each light and a faint sky reflection at the rim
  if(uGloss>0.){
    float hm=pow(max(dot(n,normalize(uMoon+v)),0.),70.), hs=pow(max(dot(n,normalize(uSun+v)),0.),40.);
    c+=(vec3(.6,.72,1.)*hm+vec3(1.6,.7,.3)*hs*.7)*uGloss;
    c+=skyBase(reflect(-v,n))*pow(1.-ndv,4.)*uGloss*.6;
  }
  c=mix(c,vCol*uGlow*uFlicker,vGlow);
  // uOpacity is 1 except on a see-through copy of a tree that hides the lead resident (see fade-view.js)
  gl_FragColor=vec4(clamp(applyFog(c,vP),0.,40.),uOpacity);
}`;

/** The one opaque surface material. sway > 0 makes it move in the wind (foliage). */
/** fuzz: 0..1 how flocked the surface is. gloss: 0..1 how glazed. Most of the world is lightly flocked. */
export function softMaterial({ sway = 0, leaf = 0, fuzz = 0.5, gloss = 0, detailRange = 0, crown = null, crownSoft = 0, crownRim = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...G, uCrownCenter: { value: crown ? crown.clone() : new THREE.Vector3() }, uCrownSoft: { value: crown ? crownSoft : 0 }, uCrownRim: { value: crown ? crownRim : 0 }, uDetailRange: {value:detailRange}, uOpacity: {value:1}, uImpactTint: {value:0}, uSway: { value: sway }, uFlicker: { value: 1 }, uLeaf: { value: leaf }, uFuzz: { value: fuzz }, uGloss: { value: gloss } },
    vertexShader: SOFT_VERT,
    fragmentShader: SOFT_FRAG,
    side: THREE.DoubleSide,
  });
}

/**
 * A see-through copy of a softMaterial: same shader and the same shared world uniforms (a plain clone would copy G),
 * its own uOpacity, blended. Writes depth so the tree still casts its shadow and its leaves do not blend twice.
 */
export function glassMaterial(source) {
  const glass = source.clone();
  for (const key of Object.keys(G)) glass.uniforms[key] = G[key];
  glass.transparent = true;
  return glass;
}

export function shaderMaterial(vertexShader, fragmentShader, extra = {}, opts = {}) {
  return new THREE.ShaderMaterial({ uniforms: { ...G, ...extra }, vertexShader, fragmentShader, ...opts });
}
