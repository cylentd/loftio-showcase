// Sky dome (dusk gradient, stars, moon, high cloud streaks) and the cloud sea far below the isles.
import * as THREE from 'three';
import { COMMON, NOISE, shaderMaterial } from './glsl.js';

const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir=position; vec4 p=projectionMatrix*viewMatrix*vec4(position+cameraPosition,1.); gl_Position=p.xyww; }`;

const DOME_FRAG = /* glsl */ `
varying vec3 vDir;
${COMMON}
${NOISE}
void main(){
  vec3 d=normalize(vDir);
  vec3 col=skyBase(normalize(vec3(d.x,max(d.y,0.),d.z)));
  float sunAz=clamp(dot(normalize(d.xz+vec2(1e-4)),normalize(uSun.xz))*.5+.5,0.,1.);
  float sd=max(dot(d,uSun),0.);
  col+=vec3(.24,.15,.2)*pow(sd,50.)*.18;

  // stars, only where the sky is dark
  vec3 sp=d*240.; vec3 cell=floor(sp); float h=hash31(cell);
  float star=step(.9935,h)*smoothstep(.32,0.,length(fract(sp)-.5));
  star*=smoothstep(.06,.4,d.y)*(.6+.4*sin(uTime*2.+h*90.));
  col+=vec3(.9,.92,1.)*star*1.6;

  // moon: pale disc with a soft halo, upper left
  vec3 M=normalize(vec3(-.52,.46,-.72));
  float md=dot(d,M);
  float disc=smoothstep(.99855,.9989,md);
  float bite=smoothstep(.99855,.9989,dot(d,normalize(M+vec3(.022,.012,0.))));
  col+=vec3(1.,.93,.8)*(disc*(1.-bite*.92)*2.6+pow(max(md,0.),700.)*.5+pow(max(md,0.),60.)*.06);

  // aurora: slow curtains of teal and violet light high in the dark side of the sky, the valley's living magic
  float drift=uTime*.018;
  vec3 aurora=vec3(0.);
  for(int layer=0;layer<12;layer++){
    float altitude=float(layer)/11.;
    vec2 plane=d.xz/max(d.y,.08)*(1.+altitude*.24);
    vec2 ribbonUV=vec2(plane.x*.86+plane.y*.5,-plane.x*.5+plane.y*.86);
    float along=ribbonUV.x;
    float fold=sin(along*1.45+drift)*.48+sin(along*2.9-drift*.6)*.16;
    float curve=ribbonUV.y-2.4-fold;
    float mainRibbon=exp(-pow(curve/.11,2.));
    float echo=exp(-pow((curve-.5-.12*sin(along*2.))/.08,2.))*.36;
    float filaments=.4+.6*vnoise(vec2(along*43.+drift*2.,drift*.3));
    float gaps=smoothstep(.18,.62,vnoise(vec2(along*.8+drift*.1,4.)));
    float taper=exp(-pow(abs(along)/3.8,4.));
    float vertical=exp(-altitude*3.4)*(1.-smoothstep(.7,1.,altitude));
    vec3 hue=mix(vec3(.12,.8,.38),vec3(.36,.17,.52),smoothstep(.12,.8,altitude));
    aurora+=hue*(mainRibbon+echo)*filaments*gaps*taper*vertical*.38;
  }
  col+=aurora*smoothstep(.04,.18,d.y);

  // high cloud streaks, lit from below by the sun
  float az=atan(d.x,-d.z);
  vec2 cp=vec2(cos(az)*2.4+d.y*7.,sin(az)*2.4+d.y*11.);
  float cl=fbm(cp+vec2(uTime*.006,0.));
  cl=smoothstep(.46,.8,cl)*smoothstep(.01,.09,d.y)*smoothstep(.5,.16,d.y);
  float under=fbm(cp+vec2(uTime*.006,.35));
  vec3 lit=mix(vec3(.025,.04,.07),vec3(.12,.1,.16),pow(sunAz,3.));
  vec3 cc=mix(lit,vec3(.05,.035,.13),smoothstep(.35,.7,under)*.6);
  col=mix(col,cc,cl*.8);

  // melt into the cloud sea's far haze so there is no hard horizon line
  col=mix(fogCol(d),col,smoothstep(-.005,.07,d.y));
  gl_FragColor=vec4(col,1.);
}`;

const SEA_VERT = /* glsl */ `
varying vec3 vP;
void main(){ vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`;

const SEA_FRAG = /* glsl */ `
varying vec3 vP;
${COMMON}
${NOISE}
float clouds(vec2 p){ return fbm(p*.0065+vec2(uTime*.008,0.))*.7+fbm(p*.026-vec2(0.,uTime*.014))*.3; }
void main(){
  vec2 p=vP.xz;
  float h=clouds(p);
  // slope toward the sun: bright where a billow faces it, shadowed behind
  vec2 sdir=normalize(uSun.xz);
  float hs=clouds(p+sdir*14.);
  float lit=clamp((h-hs)*9.+.35,0.,1.);
  vec3 ray=vP-cameraPosition; float d=length(ray);
  float toward=pow(max(dot(normalize(ray.xz),sdir),0.),2.);
  vec3 trough=vec3(.012,.012,.06), body=vec3(.085,.06,.2), top=vec3(.3,.17,.36), glow=vec3(1.3,.5,.22);
  float billow=smoothstep(.34,.66,h);
  vec3 c=mix(trough,body,billow);
  c=mix(c,top,smoothstep(.5,.75,h)*.7);
  c=mix(c,glow,lit*billow*(.12+.75*toward));
  float f=1.-exp(-d*uFog*.85);
  gl_FragColor=vec4(mix(c,fogCol(ray/d),f),1.);
}`;

export function makeSky(scene, seaY = -62) {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    shaderMaterial(DOME_VERT, DOME_FRAG, {}, { side: THREE.BackSide, depthWrite: false, depthTest: true }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), shaderMaterial(SEA_VERT, SEA_FRAG));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = seaY;
  scene.add(sea);
}
