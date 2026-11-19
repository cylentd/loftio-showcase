// Lets a painted resident take the scene's light. The painting stays; what changes is how it is lit, fogged and grounded.
// A sprite has no normals, so one is faked from the picture itself: a rounded body from the quad, tipped outward at the
// silhouette by the opacity gradient. That normal goes through the world's own shade() and applyFog(), so the residents
// pick up the moon, the sun, the lamps, the cloud-drift and the tree shadows exactly as the trees do.
import * as THREE from 'three';
import {COMMON,G} from './glsl.js';
import {RESIDENT_LIGHT as LIGHT,RESIDENT_LOOK as LOOK} from './resident-data.mjs';

const VERT_PARS=/* glsl */`varying vec2 vQuad; varying vec3 vResP;\n`;
// The quad's own 0..1 coordinates, and where this pixel sits in the world (the view rotation is orthonormal)
const VERT_TAIL=/* glsl */`
	vQuad=position.xy+.5;
	vResP=cameraPosition+mvPosition.xyz*mat3(viewMatrix);
`;

const FRAG_PARS=/* glsl */`
varying vec2 vQuad; varying vec3 vResP;
uniform float rotation; uniform mat3 mapTransform;
uniform float uFeetY;
uniform float uStrength,uGain,uFloor,uDomeCy,uDomeR,uDomeFlat,uEdgeStep,uEdgeBend,uRim,uFootDark,uFootReach,uFogShare,uFootFade,uFootFadeMin;
${COMMON}
// Outward direction of the silhouette in quad space, from the painting's own opacity. Zero in the middle of the body.
vec2 outline(sampler2D tex, vec2 uv){
  vec2 s=vec2(uEdgeStep);
  float r=texture2D(tex,uv+vec2(s.x,0.)).a, l=texture2D(tex,uv-vec2(s.x,0.)).a;
  float u=texture2D(tex,uv+vec2(0.,s.y)).a, d=texture2D(tex,uv-vec2(0.,s.y)).a;
  return vec2((l-r)*sign(mapTransform[0][0]),d-u);
}
// What the scene's light does to this pixel of a painting. Returns the lit colour, fogged.
vec3 litPainting(vec3 alb, vec2 edge){
  vec2 q=(vQuad-vec2(.5,uDomeCy))/uDomeR;
  vec3 nv=normalize(vec3(q+edge*uEdgeBend,sqrt(max(1.-dot(q,q),uDomeFlat))));
  float cs=cos(rotation),sn=sin(rotation); nv.xy=vec2(cs*nv.x-sn*nv.y,sn*nv.x+cs*nv.y);
  vec3 n=normalize(nv*mat3(viewMatrix)); // view space to world space
  vec3 v=normalize(cameraPosition-vResP);
  vec3 light=max(shade(vec3(1.),n,vResP,v)*uGain,vec3(uFloor));
  vec3 c=alb*mix(vec3(1.),light,uStrength);
  // soft glow on the outline that faces the moon (cool) and the low sun (warm)
  float rimOn=clamp(length(edge)*2.,0.,1.);
  vec3 glow=uMoonCol*max(dot(n,uMoon),0.)+uSunCol*max(dot(n,uSun),0.);
  c+=(alb*.5+.04)*glow*rimOn*uRim;
  // standing: the grass closes in around the feet
  if(uFeetY>=0.) c*=mix(uFootDark,1.,smoothstep(uFeetY,uFeetY+uFootReach,vQuad.y));
  return mix(c,applyFog(c,vResP),uFogShare);
}
`;

// Replaces the sprite's plain "outgoingLight = diffuseColor.rgb;": lit colour, and opacity that settles in at the feet.
const FRAG_BODY=/* glsl */`
	vec2 edge=outline(map,vMapUv);
	outgoingLight=clamp(litPainting(diffuseColor.rgb,edge),0.,40.);
	if(uFeetY>=0.) diffuseColor.a*=mix(uFootFadeMin,1.,smoothstep(uFeetY,uFeetY+uFootFade,vQuad.y));
`;

const constants={uStrength:LIGHT.strength,uGain:LIGHT.gain,uFloor:LIGHT.floor,uDomeCy:LIGHT.domeCentreY,uDomeR:LIGHT.domeRadius,uDomeFlat:LIGHT.domeFlat,
  uEdgeStep:LIGHT.edgeStep,uEdgeBend:LIGHT.edgeBend,uRim:LIGHT.rim,uFootDark:LIGHT.footDarkness,uFootReach:LIGHT.footReach,uFogShare:LIGHT.fogShare,
  uFootFade:LOOK.footFade,uFootFadeMin:LOOK.footFadeMin};

/** Patches a SpriteMaterial in place; returns the uniform that says where the feet are (picture height, or -1 when airborne). */
export function lightSprite(material) {
  const feet={value:-1};
  material.transparent=true;material.alphaTest=LIGHT.alphaCut;
  material.customProgramCacheKey=()=>'residentLit';
  material.onBeforeCompile=shader=>{
    for(const [key,value] of Object.entries(constants))shader.uniforms[key]={value};
    Object.assign(shader.uniforms,G);shader.uniforms.uFeetY=feet;
    shader.vertexShader=shader.vertexShader.replace('void main() {',VERT_PARS+'void main() {').replace('gl_Position = projectionMatrix * mvPosition;','gl_Position = projectionMatrix * mvPosition;'+VERT_TAIL);
    shader.fragmentShader=shader.fragmentShader.replace('void main() {',FRAG_PARS+'void main() {').replace('outgoingLight = diffuseColor.rgb;',FRAG_BODY);
  };
  return feet;
}

const SHADOW_VERT=/* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
// A soft round pool, not a hard disc: strongest in the middle, gone at the rim
const SHADOW_FRAG=/* glsl */`varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity;
void main(){ float r=length(vUv-.5)*2.; float a=pow(1.-smoothstep(.15,1.,r),1.3); gl_FragColor=vec4(uColor,a*uOpacity); }`;

/** The resident's contact shadow: a soft pool in the colour of the terrain's own shadows. */
export function shadowMaterial() {
  return new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(LOOK.shadowColor)},uOpacity:{value:0}},vertexShader:SHADOW_VERT,fragmentShader:SHADOW_FRAG,
    transparent:true,depthWrite:false});
}
