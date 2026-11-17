// One lighting model, one sky and one fog shared by every material, so the scene reads as one place.
import * as THREE from 'three';
import {LOOK} from './terrain-look-data.mjs';

/** Shared uniforms: every material holds these same objects, so one write updates the world. */
export const G = {
  uTime: { value: 0 },
  uSun: { value: new THREE.Vector3(-0.38, 0.13, -1).normalize() },
  uMoon: { value: new THREE.Vector3(0.45, 0.75, 0.55).normalize() },
  uLP: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -999, 0, 1)) },
  uLC: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
  uFog: { value: 0.0065 },
  uWind: { value: 1 },
  uGlow: { value: LOOK.emission },
  uRevealOn: { value: 0 },
  uRevealEye: { value: new THREE.Vector3() },
  uViewEye: { value: new THREE.Vector3() },
  uRevealTargets: { value: [0, 1, 2].map(() => new THREE.Vector4()) },
  // one shadow map, cast from the moon key light and centred on the player
  uShadowMap: { value: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) },
  uShadowMat: { value: new THREE.Matrix4() },
  uShadowOn: { value: 0 },
  uShadowTexel: { value: 1 / 2048 },
};
G.uShadowMap.value.needsUpdate = true;

export const NOISE = /* glsl */ `
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float hash31(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.3,9.1);a*=.5;}return s;}
`;

export const COMMON = /* glsl */ `
uniform float uTime; uniform vec3 uSun; uniform vec3 uMoon;
uniform vec4 uLP[4]; uniform vec3 uLC[4];
uniform float uFog; uniform float uWind; uniform float uGlow;
uniform sampler2D uShadowMap; uniform mat4 uShadowMat; uniform float uShadowOn; uniform float uShadowTexel;

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
  return mix(1.,.22+lit/9.*.78,edge);
}

// Dusk sky: indigo zenith, violet middle, rose low band, amber glow where the sun went down.
vec3 skyBase(vec3 d){
  float y=d.y;
  float az=clamp(dot(normalize(d.xz+vec2(1e-4)),normalize(uSun.xz))*.5+.5,0.,1.);
  vec3 zen=vec3(.004,.009,.032), mid=vec3(.018,.035,.09), low=vec3(.065,.085,.14), hor=vec3(.24,.19,.19);
  vec3 c=mix(mid,zen,smoothstep(.1,.6,y));
  // away from the sun the low sky stays cool teal-blue; toward it, rose
  c=mix(mix(vec3(.035,.075,.2),low,pow(az,1.6)),c,smoothstep(-.02,.26,y));
  float hg=exp(-max(y,0.)*10.)*pow(az,3.5);
  c=mix(c,hor,clamp(hg,0.,1.)*.92);
  c+=vec3(.12,.08,.12)*exp(-max(y,0.)*4.)*pow(az,6.)*.3;
  return c;
}
// Fog takes a dimmed sky colour at the horizon in the view direction, so far things melt into the sky.
vec3 fogCol(vec3 ray){ return skyBase(normalize(vec3(ray.x,max(ray.y,0.)*.25+.06,ray.z)))*.8; }
vec3 applyFog(vec3 c, vec3 p){
  vec3 ray=p-cameraPosition; float d=length(ray);
  float valley=1.-smoothstep(0.,18.,(p.y+cameraPosition.y)*.5);
  float f=1.-exp(-max(d-24.,0.)*uFog*(1.+valley*.65));
  return mix(c,fogCol(ray/d),f);
}
// Cool moon key from the front, warm low sun from behind, sky and ground fill, four small warm lamps.
vec3 shade(vec3 alb, vec3 n, vec3 p, vec3 v){
  float up=n.y*.5+.5;
  vec3 amb=mix(vec3(.085,.05,.11),vec3(.085,.12,.32),up);
  vec3 moon=vec3(.38,.5,.76)*pow(max(dot(n,uMoon)*.6+.4,0.),1.3);
  float sd=dot(n,uSun);
  vec3 sun=vec3(.65,.46,.32)*smoothstep(-.1,.9,sd);
  float sh=shadowAt(p,n);
  // slow patches of warm light and cool shade drift across everything, as if clouds were passing
  vec2 cq=p.xz*.021+vec2(uTime*.011,uTime*.004);
  float drift=sin(cq.x*2.1+sin(cq.y*1.7))*.5+sin(cq.y*2.9-cq.x*1.3)*.5;
  float warm=smoothstep(-.35,.6,drift);
  vec3 c=alb*(amb*(.5+.5*sh)+moon*sh*(.75+.25*warm)+sun*(.5+.5*sh)*(.45+.85*warm));
  float rim=pow(clamp(1.-dot(n,v),0.,1.),2.5)*smoothstep(-.6,.4,sd);
  c+=(alb*.7+.06)*vec3(.65,.6,.7)*rim*(.5+.5*warm);
  for(int i=0;i<4;i++){
    vec3 L=uLP[i].xyz-p; float d=length(L);
    float a=clamp(1.-d/uLP[i].w,0.,1.); a*=a;
    c+=alb*uLC[i]*a*(max(dot(n,L/d),0.)*.7+.3);
  }
  return c;
}
`;

const SOFT_VERT = /* glsl */ `
attribute vec3 aCol; attribute float aGlow;
uniform float uSway;
uniform float uDetailRange; uniform vec3 uViewEye;
varying vec3 vCol; varying vec3 vN; varying vec3 vP; varying float vGlow;
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
    float w=sin(uTime*1.1+wp.x*.35+wp.z*.27)+.5*sin(uTime*2.3+wp.x*.9+wp.y*.7);
    wp.xyz+=vec3(.12,.05,.09)*w*uSway*uWind;
  }
  vP=wp.xyz; vN=n; vCol=aCol; vGlow=aGlow;
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const SOFT_FRAG = /* glsl */ `
varying vec3 vCol; varying vec3 vN; varying vec3 vP; varying float vGlow;
uniform float uOccluder; uniform float uRevealOn;
uniform vec3 uRevealEye; uniform vec4 uRevealTargets[3];
uniform float uImpactTint; uniform float uFlicker; uniform float uLeaf; uniform float uFuzz; uniform float uGloss;
${COMMON}
${NOISE}
void main(){
  if(uOccluder*uRevealOn>.5){
    float cutaway=0.;
    for(int index=0;index<3;index++){
      vec4 target=uRevealTargets[index];
      vec3 sight=target.xyz-uRevealEye;
      float reach=length(sight);
      if(target.w>0. && reach>.01){
        vec3 direction=sight/reach;
        float along=dot(vP-uRevealEye,direction);
        float radial=length(vP-uRevealEye-direction*along);
        float corridor=1.-smoothstep(target.w*.95,target.w,radial);
        float inFront=smoothstep(0.,.3,along)*(1.-smoothstep(reach-.6,reach,along));
        cutaway=max(cutaway,corridor*inFront);
      }
    }
    if(hash21(floor(gl_FragCoord.xy))<cutaway) discard;
  }
  vec3 v=normalize(cameraPosition-vP);
  vec3 n=dot(vN,vN)>1e-8 ? normalize(vN) : vec3(0.,1.,0.); if(!gl_FrontFacing) n=-n;
  vec3 alb=vCol*(1.-uImpactTint);
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
  // glazed ceramic and vinyl: a tight highlight from each light and a faint sky reflection at the rim
  if(uGloss>0.){
    float hm=pow(max(dot(n,normalize(uMoon+v)),0.),70.), hs=pow(max(dot(n,normalize(uSun+v)),0.),40.);
    c+=(vec3(.6,.72,1.)*hm+vec3(1.6,.7,.3)*hs*.7)*uGloss;
    c+=skyBase(reflect(-v,n))*pow(1.-ndv,4.)*uGloss*.6;
  }
  c=mix(c,vCol*uGlow*uFlicker,vGlow);
  gl_FragColor=vec4(clamp(applyFog(c,vP),0.,40.),1.);
}`;

/** The one opaque surface material. sway > 0 makes it move in the wind (foliage). */
/** fuzz: 0..1 how flocked the surface is. gloss: 0..1 how glazed. Most of the world is lightly flocked. */
export function softMaterial({ sway = 0, leaf = 0, fuzz = 0.5, gloss = 0, detailRange = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...G, uDetailRange: {value:detailRange}, uOccluder: {value:0}, uImpactTint: {value:0}, uSway: { value: sway }, uFlicker: { value: 1 }, uLeaf: { value: leaf }, uFuzz: { value: fuzz }, uGloss: { value: gloss } },
    vertexShader: SOFT_VERT,
    fragmentShader: SOFT_FRAG,
    side: THREE.DoubleSide,
  });
}

export function shaderMaterial(vertexShader, fragmentShader, extra = {}, opts = {}) {
  return new THREE.ShaderMaterial({ uniforms: { ...G, ...extra }, vertexShader, fragmentShader, ...opts });
}
