// Shader code for the valley floor: the ground sheet and the meadow of blades. Behaviour only; every strength
// lives in terrain-look-data.mjs (MEADOW_LOOK) and reaches the shaders as the uniforms named in LOOK_UNIFORMS.
import { COMMON, NOISE } from './glsl.js';
import { MEADOW_LOOK } from './terrain-look-data.mjs';

/** Uniform name -> MEADOW_LOOK key. One list feeds the uniform objects and the GLSL declarations, so they cannot drift. */
const LOOK_KEYS = {
  uGroundGrain: 'groundGrain', uGroundMottle: 'groundMottle', uMeadowSoftness: 'softness', uFarFrom: 'farFrom', uFarWiden: 'farWiden',
  uGroundGrass: 'groundGrass', uGroundTop: 'groundTop', uGroundBlade: 'groundBlade', uBladeNear: 'bladeNear', uBladeFar: 'bladeFar',
  uRound: 'round', uEdgeDark: 'edgeDark', uJitterValue: 'jitterValue', uJitterHue: 'jitterHue', uClumpSize: 'clumpSize',
  uClumpLean: 'clumpLean', uClumpShade: 'clumpShade', uClumpHeight: 'clumpHeight', uTipCurl: 'tipCurl', uPatchScale: 'patchScale',
  uPatchTint: 'patchTint', uPatchLight: 'patchLight', uDryPatch: 'dryPatch', uCloverPatch: 'cloverPatch', uEdgeScale: 'edgeScale',
  uEdgeNoise: 'edgeNoise', uEdgeHeight: 'edgeHeight', uEdgeLean: 'edgeLean', uPathShadow: 'pathShadow',
  uWindDir: 'windDir', uGustScale: 'gustScale', uGustSpeed: 'gustSpeed', uGustStretch: 'gustStretch', uGustCalm: 'gustCalm',
  uGustFull: 'gustFull', uGustWarp: 'gustWarp', uGustBend: 'gustBend', uGustLift: 'gustLift', uGustTint: 'gustTint', uGustCalmDim: 'gustCalmDim', uBreeze: 'breeze',
  uBreezeRate: 'breezeRate', uBreezeWave: 'breezeWave', uFlutter: 'flutter', uFlutterRate: 'flutterRate',
  uStiffSpread: 'stiffSpread', uClumpWind: 'clumpWind', uClumpPhase: 'clumpPhase', uWindYaw: 'windYaw',
  uSwitchFrom: 'switchFrom', uSwitchSink: 'switchSink', uSwitchMargin: 'switchMargin', uSwitchCurve: 'switchCurve',
  uRingFrom: 'ringFrom', uRingFull: 'ringFull', uRingDetail: 'ringDetail', uRingFlat: 'ringFlat', uStreak: 'streak', uStreakScale: 'streakScale',
  uStreakStretch: 'streakStretch', uStreakSway: 'streakSway', uStreakNear: 'streakNear', uStreakFull: 'streakFull',
  uStreakFadeFrom: 'streakFadeFrom', uStreakFadeTo: 'streakFadeTo', uGustDetail: 'gustDetail', uStreakDetail: 'streakDetail',
};
export const lookUniforms = () => Object.fromEntries(Object.entries(LOOK_KEYS).map(([u, k]) => [u, { value: MEADOW_LOOK[k] }]));
const LOOK_DECL = Object.keys(LOOK_KEYS).map((u) => `uniform float ${u};`).join(' ');

export const GROUND_VERT = /* glsl */ `
attribute vec3 aCol;
varying vec3 vCol; varying vec3 vN; varying vec3 vP;
void main(){ vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); vCol=aCol; gl_Position=projectionMatrix*viewMatrix*wp; }`;

// Colour and the ragged border, shared by blade and ground so the ground can wear the same grass above it.
const GRASS_EDGE = /* glsl */ `
// how far noise pushes where the grass/path border falls; the same on blades and ground so they agree
float grassEdge(vec2 xz){ return (vnoise(xz*uEdgeScale)-.5)*uEdgeNoise; }`;
const GRASS_ALBEDO = /* glsl */ `
// The colour of a blade at height h (0 root .. 1 tip).
vec3 grassAlbedo(vec2 xz,float h,float soft){
  float pa=vnoise(xz*.22), pb=vnoise(xz*.7+31.);
  vec3 base=mix(vec3(.008,.04,.03),vec3(.015,.06,.025),pa);
  vec3 tip=mix(vec3(.03,.17,.07),vec3(.11,.25,.05),pb*pa);
  tip=mix(tip,vec3(.04,.19,.14),smoothstep(.55,.8,vnoise(xz*.09+7.))*.6);
  // large drifts: warmer or cooler, lighter or darker, with a few straw and clover patches
  float drift=smoothstep(.25,.75,vnoise(xz*uPatchScale+3.));
  tip*=mix(vec3(1.),mix(vec3(.8,1.,1.18),vec3(1.28,1.06,.66),drift),uPatchTint);
  tip*=1.+(vnoise(xz*uPatchScale*2.3+13.)-.5)*uPatchLight*2.;
  tip=mix(tip,vec3(.17,.2,.06),smoothstep(.66,.82,vnoise(xz*.045+23.))*uDryPatch);
  tip=mix(tip,vec3(.06,.27,.12),smoothstep(.68,.84,vnoise(xz*.13+41.))*uCloverPatch);
  return mix(mix(base,tip,soft),tip,h*h);
}
vec3 grassNormal(){ return normalize(vec3(0.,1.,0.)+uSun*.3); }
vec3 grassGlow(vec3 alb,vec3 v,float h){ return alb*vec3(3.,1.5,.5)*pow(max(dot(-v,uSun),0.),3.)*h*1.6; }`;

// The wind field: 0 calm .. 1 full gust (times uWind), scrolling along the wind. Blades (vertex) and ground (fragment) both call it,
// so the pale band on the ground and on the blade tops is the same band. Smooth waves, stretched across the wind into fronts.
const GUST = /* glsl */ `
const vec3 SHEEN=vec3(.045,.06,.1); // cool moon-sky light that bent tips reflect, at full gust and tint 1
vec2 windDir(){ return vec2(cos(uWindDir),sin(uWindDir)); }
// Three smooth waves crossing at different angles (weights sum to 1), the first bent by a slow sideways wave: no cells, no straight ridges.
// Value noise showed its square grid at one octave, so the gust no longer reads it. Each row: weight, along-wind frequency, across frequency, phase.
const vec4 GUST_WAVE_A=vec4(.5,3.1,0.,0.);   // the main front, bent by the warp
const vec4 GUST_WAVE_B=vec4(.3,1.9,2.3,2.1); // a slanted wave that breaks the fronts into long lobes
const vec4 GUST_WAVE_C=vec4(.2,.7,-3.7,4.);  // a slow cross wave so no two fronts alike
const float GUST_WARP_FREQ=1.7, GUST_WARP_PHASE=1.3, GUST_RIPPLE_FREQ=7.9, GUST_RIPPLE_CROSS=6.1, GUST_RIPPLE_BEND=1.5;
float gustWave(vec4 w,vec2 q,float bend){ return w.x*sin(q.x*w.y+q.y*w.z+w.w+bend); }
float gustAt(vec2 xz){
  vec2 d=windDir();
  vec2 q=vec2(dot(xz,d)-uTime*uGustSpeed,dot(xz,vec2(d.y,-d.x))*uGustStretch)*uGustScale;
  float n=gustWave(GUST_WAVE_A,q,sin(q.y*GUST_WARP_FREQ+GUST_WARP_PHASE)*uGustWarp)+gustWave(GUST_WAVE_B,q,0.)+gustWave(GUST_WAVE_C,q,0.);
  n=.5+.5*n;
  // desktop only: a finer ripple riding on the front, a share of the field
  if(uGustDetail>0.) n=n*(1.-uGustDetail)+(.5+.5*sin(q.x*GUST_RIPPLE_FREQ+sin(q.y*GUST_RIPPLE_CROSS)*GUST_RIPPLE_BEND))*uGustDetail;
  return smoothstep(uGustCalm,uGustFull,n)*uWind;
}
// tips lighten where the gust bends them: albedo gain and extra sky sheen, both growing with h^2 (the tip)
// in the calm between gusts the tips sit a little darker, so the gust reads as a pale band against them
vec3 gustLight(vec3 alb,float gust,float h){ float calm=max(min(uWind,1.)-gust,0.); return alb*(1.+h*h*(gust*uGustLift-calm*uGustCalmDim)); }
vec3 gustSheen(float gust,float h){ return SHEEN*gust*uGustTint*h*h; }`;

// Far ground wears blade-like strokes: short streaks along the wind, light tips against dark gaps, sliding downwind with the gust.
const STREAK = /* glsl */ `
vec2 grassGrainUV(vec2 xz){
  vec2 d=windDir();
  return vec2(dot(xz,d)*uStreakStretch,dot(xz,vec2(d.y,-d.x)))*uStreakScale;
}
float grassStreak(vec2 q,float gust,float span){
  q.x+=gust*uStreakSway*uStreakStretch*uStreakScale;
  float cover=1.-smoothstep(.35,1.,span);
  float n=vnoise(q);
  if(uStreakDetail>0.){
    float detail=uStreakDetail*(1.-smoothstep(.35,1.,span*2.3));
    if(detail>0.) n=mix(n,vnoise(q*2.3+vec2(17.,5.)),detail);
  }
  return (n-.5)*2.*cover;
}`;

export const GROUND_FRAG = /* glsl */ `
varying vec3 vCol; varying vec3 vN; varying vec3 vP;
uniform sampler2D uMaskTex; uniform float uHalf; uniform float uHazeFrom; uniform float uHazeTail; ${LOOK_DECL}
${COMMON}
${NOISE}
${GUST}
${STREAK}
${GRASS_EDGE}
${GRASS_ALBEDO}
// the ground stops wearing the meadow's colour over this height band (was 30..50; the bowl's rim hills now reach about 42)
const vec2 GRASS_TOP=vec2(45.,65.);
// the far ranges fog as if nearer: past uHazeFrom only uHazeTail of the extra distance counts (terrain.js LAND.haze)
vec3 hazePoint(vec3 p){
  vec3 r=p-cameraPosition; float d=length(r);
  return d<=uHazeFrom ? p : cameraPosition+r*((uHazeFrom+(d-uHazeFrom)*uHazeTail)/d);
}
void main(){
  vec3 v=normalize(cameraPosition-vP);
  vec3 n=normalize(vN);
  vec2 q=grassGrainUV(vP.xz), grainFootprint=fwidth(q);
  float grainSpan=max(grainFootprint.x,grainFootprint.y);
  vec2 uv=(vP.xz+uHalf)/(2.*uHalf);
  vec4 mk=(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.) ? texture2D(uMaskTex,uv) : vec4(0.,0.,0.,1.);
  float mottle=vnoise(vP.xz*.35)*.6+vnoise(vP.xz*1.7)*.4;
  vec3 alb=vCol*(1.+uGroundMottle*(mottle-.5));
  // where grass grows on gentle low ground, the ground is the top of the meadow: same colour, same light, blade-scale mottle
  float gw=uGroundGrass*mk.a*smoothstep(.45,.7,n.y)*(1.-smoothstep(GRASS_TOP.x,GRASS_TOP.y,vP.y));
  // the path border is ragged (the blades use the same noise) and passes through grass shadow before it is soil
  float pathW=smoothstep(.12,.88,clamp(mk.r-grassEdge(vP.xz),0.,1.));
  // the grass colour is the costly part (a dozen noise reads), so rock, snow, sand and water never pay for it
  vec3 galb=vec3(0.); float gust=0.;
  if(gw>0.||pathW>0.){
    float near=1.-smoothstep(uBladeNear,uBladeFar,distance(cameraPosition,vP));
    galb=grassAlbedo(vP.xz,uGroundTop,uMeadowSoftness);
    if(near>0.) galb*=1.+(vnoise(vP.xz*14.)*.6+vnoise(vP.xz*31.)*.4-.5)*uGroundBlade*near;
    // the ground wears the gust band too, as the blade tops at groundTop would
    if(gw>0.) gust=gustAt(vP.xz);
    // beyond the blades: strokes of light tip and dark gap, strongest where the blades sink, gone before they would shimmer
    float gd=distance(cameraPosition,vP);
    float stroke=smoothstep(uStreakNear,uStreakFull,gd)*(1.-smoothstep(uStreakFadeFrom,uStreakFadeTo,gd))*uStreak;
    if(gw>0.&&stroke>0.) galb*=1.+grassStreak(q,gust,grainSpan)*stroke;
    galb=gustLight(galb,gust,uGroundTop);
  }
  alb=mix(alb,galb,gw);
  n=normalize(mix(n,grassNormal(),gw));
  vec3 dirt=mix(vec3(.3,.2,.12),vec3(.42,.3,.18),mottle);
  vec3 sand=mix(vec3(.62,.47,.28),vec3(.78,.62,.4),vnoise(vP.xz*.9));
  vec3 bed=vec3(.12,.13,.14)+.08*mottle;
  alb=mix(alb,sand,mk.g);
  alb=mix(alb,mix(galb*uPathShadow,dirt,smoothstep(.25,.95,pathW)),pathW);
  alb=mix(alb,bed,mk.b);
  // the ground is flocked like a model-railway mat: fine grain, soft halo at grazing angles
  alb*=1.+(vnoise(vP.xz*9.)-.5)*uGroundGrain*(1.-mk.r)*(1.-mk.b);
  vec3 c=shade(alb,n,vP,v);
  c+=grassGlow(galb,v,uGroundTop)*gw+gustSheen(gust,uGroundTop)*gw;
  c+=alb*vec3(.5,.56,.95)*pow(1.-clamp(dot(n,v),0.,1.),2.2)*.45*(1.-mk.b);
  gl_FragColor=vec4(clamp(applyFog(c,hazePoint(vP)),0.,40.),1.);
}`;

export const MEADOW_VERT = /* glsl */ `
uniform sampler2D uHeightTex; uniform sampler2D uMaskTex; uniform float uHalf; uniform float uTile; uniform float uRing; uniform vec3 uFocus; uniform vec3 uBodies[3]; uniform float uPress; uniform float uFlower; uniform vec4 uPop; uniform float uPopPower; uniform vec3 uGarden;
${LOOK_DECL}
varying float vH; varying vec3 vP; varying vec3 vRoot; varying float vU; varying vec3 vAx; varying vec3 vJit; varying float vDetail; varying float vGust; varying float vFade;
const float TAU=6.2832;
const float ARC_EPSILON=.01;
${COMMON}
${NOISE}
${GUST}
${GRASS_EDGE}
// the direction the grass border leans over the path: away from where the grass is thicker
vec2 rimPush(vec2 uv){
  float d=.6/(2.*uHalf);
  vec2 grad=vec2(texture2D(uMaskTex,uv+vec2(d,0.)).a-texture2D(uMaskTex,uv-vec2(d,0.)).a,texture2D(uMaskTex,uv+vec2(0.,d)).a-texture2D(uMaskTex,uv-vec2(0.,d)).a);
  return -normalize(grad+vec2(1e-5));
}
void main(){
  vec3 seat=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
  vec2 rel=mod(seat.xz-uFocus.xz+uTile*.5,uTile)-uTile*.5;
  vec2 xz=uFocus.xz+rel;
  vec2 uv=(xz+uHalf)/(2.*uHalf);
  // grass thins over a band at a border instead of stopping at a line: shorter, then gone, with noise on where
  float g=clamp(texture2D(uMaskTex,uv).a+grassEdge(xz),0.,1.);
  float keep=smoothstep(.15,.6,g);
  float rim=g*(1.-g)*4.;
  vec2 push=rim>.01 ? rimPush(uv)*rim : vec2(0.);
  float tall=mix(uEdgeHeight,1.,smoothstep(.4,.95,g));
  // far blades sink into the ground: height falls to nothing at the tile edge (where blades wrap), width grows meanwhile
  // each blade has its own switch distance (a hash of its seat): a fine blade is full height inside it and sinks over uSwitchSink past it,
  // a coarse blade (uRing 1) is no height inside it and grows over uSwitchSink past it. The ring keeps its own far-edge sink.
  float dist=length(rel);
  float sw=pow(hash21(seat.xz*1.93+41.7),uSwitchCurve);
  float swFine=mix(uSwitchFrom,uTile*.5-uSwitchMargin-uSwitchSink,sw);
  float swRing=mix(uSwitchFrom,uRingFull-uSwitchSink,sw);
  // A blade never changes size at its switch (owner, 2026-11-17: "growing and shrinking as I'm walking"): it dissolves. fade 0 = drawn whole,
  // 1 = gone; the fragment shader drops a growing share of its pixels in between, and a blade that is fully gone is collapsed to cost nothing.
  float fade=uRing>.5 ? 1.-smoothstep(swRing,swRing+uSwitchSink,dist) : smoothstep(swFine,swFine+uSwitchSink,dist);
  // the ring's own far edge dissolves the same way (owner, same day: "in the far distance it's drawing the grass in as I'm walking"):
  // each coarse blade has a second switch between uFarFrom (ringFarFrom on the ring) and its tile edge, with a sink twice as long since it is far away
  float farSink=uSwitchSink*2.;
  float swFar=mix(uFarFrom,uTile*.5-uSwitchMargin-farSink,hash21(seat.zx*2.71+7.3));
  if(uRing>.5) fade=max(fade,smoothstep(swFar,swFar+farSink,dist));
  vFade=fade;
  float far=0.; // no blade sinks or widens with distance any more
  float grow=1.-step(1.,fade);
  // the meadow is lush everywhere; blades just run shorter and taller in drifts
  keep*=mix(.72,1.,smoothstep(.25,.75,vnoise(xz*.09)));
  // flowers only grow in drifts
  if(uFlower>.5){
    float garden=1.-smoothstep(uGarden.z*.55,uGarden.z,distance(xz,uGarden.xy));
    keep*=max(smoothstep(.52,.7,vnoise(xz*.045+11.))*step(.35,fract(seat.x*7.31+seat.z*3.17)),garden*step(.8,fract(seat.x*7.31+seat.z*3.17)));
    tall=1.;
  }
  keep*=step(abs(xz.x),uHalf-2.)*step(abs(xz.y),uHalf-2.);
  // tufts: blades in one cell lean toward its centre, and the cell has its own lightness and height
  vec2 cell=floor(xz/uClumpSize);
  vec2 centre=(cell+.5+(vec2(hash21(cell),hash21(cell+19.7))-.5)*.6)*uClumpSize;
  float soft=1.-uFlower; // flowers keep their stems straight
  tall*=mix(1.,1.+(hash21(cell+8.1)-.5)*uClumpHeight,soft);
  float b1=hash21(seat.xz*.731+3.1), b2=hash21(seat.zx*1.37+5.3), b3=hash21(seat.xz*2.11+17.9);
  vec3 root=vec3(xz.x,texture2D(uHeightTex,uv).r-.04,xz.y);
  float wide=mix(1.+(uFarWiden-1.)*far,1.-far,uFlower); // flowers just shrink
  vec3 local=mat3(instanceMatrix)*(position*vec3(wide,(1.-far)*tall,wide))*keep*grow;
  keep*=grow; // a ring blade that has not grown yet bends, curls and leans by nothing
  float h=position.y, hh=h*h*keep;
  float ang=b3*6.2832;
  local.xz+=(vec2(.07,.04)+vec2(cos(ang),sin(ang))*uTipCurl*(.4+.6*b1))*hh; // each tip bends its own way
  float detail=1.-smoothstep(uFarFrom*.4,uTile*.5-8.,length(rel)); // blade-scale detail fades out before the tile edge
  if(uRing>.5) detail=uRingDetail*(1.-smoothstep(uFarFrom,uTile*.5-8.,length(rel)));
  // geometry detail (tuft lean, flutter) is constant, so a blade keeps one shape and only its switch shows or sinks it; only colour detail fades with distance
  float shape=uRing>.5 ? uRingDetail : 1.;
  local.xz+=((centre-xz)*uClumpLean*shape+push*uEdgeLean)*hh*soft;
  keep*=1.-far; // wind, pressing and shockwaves fade with the height
  // wind: a gust field scrolls across the meadow; a tuft samples it at its centre (a little earlier or later than its neighbours)
  vec2 wd=windDir();
  float gust=gustAt(mix(xz,centre,uClumpWind)+wd*(hash21(cell+29.1)-.5)*uClumpPhase);
  vGust=gust;
  // each blade bends off the wind by its own yaw, is stiffer or softer, and trembles faster when the gust is strong
  float yaw=(b1-.5)*uWindYaw, cy=cos(yaw), sy=sin(yaw);
  vec2 bd=vec2(wd.x*cy-wd.y*sy,wd.x*sy+wd.y*cy);
  float swell=(1.+sin(uTime*uBreezeRate-dot(xz,wd)*uBreezeWave+b1*TAU))/2.;
  float flutter=sin(uTime*uFlutterRate+b3*TAU)*uFlutter*gust*shape;
  float bend=(uBreeze*swell*uWind+gust*uGustBend+flutter)*(1.-uStiffSpread*b2);
  // the blade is an arc of constant curvature: the tip moves downwind and down, and the length is kept
  float arc=bend*h;
  float rise=abs(arc)<ARC_EPSILON ? 1.-arc*arc/6. : sin(arc)/arc;
  float reach=abs(arc)<ARC_EPSILON ? arc*.5 : (1.-cos(arc))/arc;
  vec3 wp=root+local;
  wp.xz+=bd*local.y*reach;
  wp.y-=local.y*(1.-rise);
  for(int i=0;i<3;i++){
    vec2 away=root.xz-uBodies[i].xz; float d=length(away);
    float press=(1.-smoothstep(.4,2.6,d))*(1.-smoothstep(1.5,3.5,uBodies[i].y-root.y))*keep*uPress;
    wp.xz+=away/max(d,.05)*press*h*1.2; wp.y-=press*h*.6;
  }
  // a shockwave passing through: blades at the wavefront are thrown flat, outward
  if(uPopPower>0.){
    vec2 out2=root.xz-uPop.xz; float od=length(out2);
    float front=(1.-smoothstep(0.,3.2,abs(od-uPop.w)))*uPopPower*keep;
    wp.xz+=out2/max(od,.05)*front*h*1.6; wp.y-=front*h*.7;
  }
  vH=h; vP=wp; vRoot=root;
  vU=sign(position.x); // -1 .. 1 across the blade once interpolated
  vec3 ax=mat3(instanceMatrix)[0]; vAx=normalize(vec3(ax.x,0.,ax.z)+vec3(1e-5));
  vJit=vec3(b1-.5,b2-.5,hash21(cell+3.3)-.5);
  // blade-scale shading fades out before the tile edge, so the far blades match the ground that wears their average colour
  vDetail=detail; // far blades shade like the ground that wears their average colour
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);
}`;

export const MEADOW_FRAG = /* glsl */ `
varying float vH; varying vec3 vP; varying vec3 vRoot; varying float vU; varying vec3 vAx; varying vec3 vJit; varying float vDetail; varying float vGust; varying float vFade;
uniform float uFlower; uniform float uRing; ${LOOK_DECL}
${COMMON}
${NOISE}
${GUST}
${GRASS_ALBEDO}
void main(){
  // dissolve at the blade's switch distance: interleaved gradient noise (Jimenez 2014, the published constants) gives each pixel a threshold
  if(vFade>0.&&vFade>=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))) discard;
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
  float groundBlend=max(uRing*uRingFlat,smoothstep(uBladeNear,uBladeFar,distance(cameraPosition,vRoot)))*(1.-uFlower);
  float grassHeight=mix(vH,uGroundTop,groundBlend);
  float bladeDetail=vDetail*(1.-groundBlend);
  vec3 alb=grassAlbedo(vRoot.xz,grassHeight,uMeadowSoftness);
  // every blade, and every tuft, is a little lighter, darker, warmer or cooler than its neighbours
  alb*=1.+(vJit.x*uJitterValue+vJit.z*uClumpShade)*bladeDetail;
  alb*=vec3(1.+vJit.y*uJitterHue*bladeDetail,1.,1.-vJit.y*uJitterHue*bladeDetail);
  // lit as if rounded across its width: one side catches the light, the edges fall off
  float u=clamp(vU,-1.,1.);
  alb*=1.-uEdgeDark*u*u*bladeDetail;
  vec3 n=normalize(grassNormal()+vAx*u*uRound*bladeDetail);
  // bent tips face the sky: lighter, with a cool sheen. Coarse ring blades light up as the ground does (at its height), so no step at the handover
  alb=gustLight(alb,vGust,grassHeight);
  vec3 c=shade(alb,n,vP,v);
  c+=grassGlow(alb,v,grassHeight)+gustSheen(vGust,grassHeight);
  gl_FragColor=vec4(applyFog(c,vP),1.);
}`;
