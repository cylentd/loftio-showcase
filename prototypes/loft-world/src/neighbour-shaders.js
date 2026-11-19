// Materials for the code-built neighbours: Puff's fur and Slime's jelly. Lit and fogged with the world's shared chunks.
import * as THREE from 'three';
import {COMMON,NOISE,shaderMaterial} from './glsl.js';

// Object-space coordinates (vO) keep fur grain and colour bands fixed to the body as it moves and squashes.
const VERT=/* glsl */`
attribute vec3 aCol;
uniform float uJiggle; uniform float uPhase;
varying vec3 vCol; varying vec3 vN; varying vec3 vP; varying vec3 vO;
void main(){
  vec3 p=position;
  p.x+=sin(uPhase+p.y*3.1)*uJiggle*p.y;
  p.z+=cos(uPhase*1.3+p.y*2.7)*uJiggle*p.y;
  vec4 wp=modelMatrix*vec4(p,1.);
  vO=position; vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); vCol=aCol;
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;

const FUR_FRAG=/* glsl */`
varying vec3 vCol; varying vec3 vN; varying vec3 vP; varying vec3 vO;
uniform vec3 uRim; uniform float uScale; uniform float uStrand; uniform float uEdge; uniform float uGrain; uniform float uTuft; uniform float uSelf; uniform float uHalo; uniform float uRimOn;
${COMMON}
${NOISE}
float n3(vec3 q){return vnoise(q.xy+q.z*1.7)*.5+vnoise(q.yz*1.3+q.x*2.1+7.)*.5;}
void main(){
  vec3 v=normalize(cameraPosition-vP), base=normalize(vN);
  vec3 q=vO*uScale;
  // clumps: each tuft tilts its own way, so light breaks into soft lit and shaded patches
  vec3 n=normalize(base+(vec3(n3(q),n3(q+11.),n3(q+23.))-.5)*uTuft);
  float strand=n3(vO*uScale*4.3), tuftEdge=n3(vO*uScale*uStrand+5.);
  float facing=clamp(dot(base,v),0.,1.);
  // the silhouette frays: near the edge, tufts with low noise are cut, so the outline is fuzzy, not a hard curve
  if(facing<uEdge*tuftEdge*tuftEdge) discard;
  vec3 alb=vCol*(1.+uGrain*(strand-.5));
  float ndv=clamp(dot(n,v),0.,1.);
  vec3 c=shade(alb,n,vP,v)+alb*uSelf;
  c+=(alb*.8+.03)*vec3(.5,.56,.95)*pow(1.-ndv,2.2)*uHalo;
  c+=uRim*pow(1.-facing,2.)*smoothstep(-.2,.8,base.y)*uRimOn;
  gl_FragColor=vec4(clamp(applyFog(c,vP),0.,40.),1.);
}`;

const JELLY_FRAG=/* glsl */`
varying vec3 vCol; varying vec3 vN; varying vec3 vP; varying vec3 vO;
uniform vec3 uTop; uniform vec3 uBase; uniform vec3 uGlint;
uniform float uTopY; uniform float uAlphaCore; uniform float uAlphaRim; uniform float uSelf; uniform float uSub; uniform float uSharp; uniform float uFres;
${COMMON}
void main(){
  vec3 v=normalize(cameraPosition-vP), n=normalize(vN);
  float ndv=clamp(dot(n,v),0.,1.), fres=pow(1.-ndv,uFres);
  vec3 alb=mix(uBase,uTop,smoothstep(0.,uTopY,vO.y));
  vec3 c=shade(alb,n,vP,v)*.6+alb*uSelf;
  c+=alb*fres*.9;
  // light caught inside the jelly pools at its base
  c+=uBase*(1.-smoothstep(0.,.55,vO.y))*uSub;
  // two studio glints held to the camera, upper left, so the gloss always shows like the sprite's
  vec3 l1=normalize((vec4(-.55,.75,.45,0.)*viewMatrix).xyz), l2=normalize((vec4(-.2,.35,.9,0.)*viewMatrix).xyz);
  float g=pow(max(dot(reflect(-l1,n),v),0.),uSharp), g2=pow(max(dot(reflect(-l2,n),v),0.),uSharp*.5);
  float glint=smoothstep(.35,.6,g)+smoothstep(.4,.7,g2)*.7;
  c+=uGlint*glint;
  c+=skyBase(reflect(-v,n))*fres*.5;
  float a=clamp(mix(uAlphaCore,uAlphaRim,fres)+glint,0.,1.);
  gl_FragColor=vec4(clamp(applyFog(c,vP),0.,40.),a);
}`;

const BUBBLE_FRAG=/* glsl */`
varying vec3 vCol; varying vec3 vN; varying vec3 vP; varying vec3 vO;
${COMMON}
void main(){
  vec3 v=normalize(cameraPosition-vP), n=normalize(vN);
  float ring=pow(1.-clamp(dot(n,v),0.,1.),2.);
  vec3 l=normalize((vec4(-.55,.75,.45,0.)*viewMatrix).xyz);
  float g=smoothstep(.5,.8,pow(max(dot(reflect(-l,n),v),0.),40.));
  gl_FragColor=vec4(applyFog(vCol*(ring+g),vP),clamp(ring*.8+g,0.,1.));
}`;

const color=hex=>new THREE.Color(hex);
const motionUniforms=()=>({uJiggle:{value:0},uPhase:{value:0}});

/** Puff's fur: opaque, fraying at the silhouette, with a warm rim. */
export function furMaterial(fur,rim){
 return shaderMaterial(VERT,FUR_FRAG,{...motionUniforms(),uRim:{value:color(rim)},uScale:{value:fur.scale},uStrand:{value:fur.strand},uEdge:{value:fur.edge},
  uGrain:{value:fur.grain},uTuft:{value:fur.tuft},uSelf:{value:fur.self},uHalo:{value:fur.halo},uRimOn:{value:fur.rim}});
}
/** Slime's jelly: see-through in the middle, solid at the rim, with glints. Drawn after what is inside it. */
export function jellyMaterial(glass,colors,topY){
 return shaderMaterial(VERT,JELLY_FRAG,{...motionUniforms(),uTop:{value:color(colors.top)},uBase:{value:color(colors.base)},uGlint:{value:color(colors.glint)},
  uTopY:{value:topY},uAlphaCore:{value:glass.alphaCore},uAlphaRim:{value:glass.alphaRim},uSelf:{value:glass.self},uSub:{value:glass.sub},uSharp:{value:glass.glint},uFres:{value:glass.fres}},
  {transparent:true,depthWrite:false});
}
/** Bubbles: a bright ring and a glint, clear in the middle. */
export function bubbleMaterial(){
 return shaderMaterial(VERT,BUBBLE_FRAG,motionUniforms(),{transparent:true,depthWrite:false});
}
