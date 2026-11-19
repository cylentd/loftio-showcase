// Puff and Slime as real meshes: googly eyes first, then a fuzzy cloud and a glossy jelly around them.
import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {G,softMaterial} from './glsl.js';
import {blob,merge,place,tint} from './util.js';
import {NEIGHBOUR_LOOK as L,NEIGHBOUR_COLORS as K} from './neighbour-look-data.mjs';
import {blink,squashStretch,hopShape,faceYaw,turnToward} from './neighbour-motion.mjs';
import {furMaterial,jellyMaterial,bubbleMaterial} from './neighbour-shaders.js';

const E=L.eye,M=L.motion;
const ellipsoid=(segments,[x,y,z,sx,sy,sz],color,glow=0)=>place(tint(new THREE.SphereGeometry(1,...segments),color,glow),x,y,z,0,0,0,sx,sy,sz);

/** One googly eye: an outer pivot that blinks, an inner one that turns the pupil to look. */
function googlyEye([x,y,z,r,gx,gy],material){
 const front=E.pupilDepth*E.pupilSize;
 const parts=[ellipsoid(E.segments,[0,0,0,r,r,r],K.eyeWhite,E.glow),
  ellipsoid(E.pupilSegments,[0,0,r*(1-front/2),r*E.pupilSize,r*E.pupilSize,r*front],K.pupil),
  ellipsoid(E.catchSegments,[r*E.pupilSize*E.catchAt[0],r*E.pupilSize*E.catchAt[1],r*(1+front/4),r*E.catchSize,r*E.catchSize,r*E.catchSize*front],K.catchlight,1)];
 const look=new THREE.Mesh(merge(parts),material),lid=new THREE.Group();
 lid.position.set(x,y,z);lid.add(look);
 return {lid,look,rest:{x:gx,y:gy},gaze:{x:gx,y:gy}};
}
function eyes(defs,group){
 const material=softMaterial({fuzz:0,gloss:E.gloss});
 return defs.map(d=>{const eye=googlyEye(d,material);group.add(eye.lid);return eye;});
}
function puffFurColor(c,x,y){
 const P=L.puff;
 c.lerp(new THREE.Color(K.puffShade),Math.max(0,1-y/P.shadeBelow)*P.shadeAmount).lerp(new THREE.Color(K.puffLight),Math.min(1,Math.max(0,y-P.lightAbove)*P.lightAmount));
}
function puffBody(){
 const P=L.puff,lump=(d,i)=>blob(P.seed+i,P.lump,P.lumpFreq,P.lobeDetail);
 const bake=(geometry,[x,y,z,sx,sy,sz])=>{place(geometry,x,y,z,0,0,0,sx,sy,sz);return tint(geometry,K.puffFur,0,puffFurColor);};
 const lobes=P.lobes.map((d,i)=>bake(lump(d,i),d)),feet=P.feet.map(d=>bake(new THREE.IcosahedronGeometry(1,P.footDetail),d));
 return new THREE.Mesh(merge([...lobes,...feet]),furMaterial(P.fur,K.puffRim));
}
function puffMouth(){
 const P=L.puff,[x,y,z,sx,sy,sz]=P.mouth;
 const lip=place(tint(new THREE.SphereGeometry(1,...P.mouthSegments,0,Math.PI*2,Math.PI/2,Math.PI/2),K.mouth),x,y,z,0,0,0,sx,sy,sz);
 return new THREE.Mesh(merge([lip,ellipsoid(P.mouthSegments,P.tongue,K.tongue)]),softMaterial({fuzz:0,gloss:E.gloss}));
}
function buildPuff(){
 const group=new THREE.Group();
 const body=puffBody();group.add(body,puffMouth());
 return {group,eyes:eyes(L.puff.eyes,group),skin:[body.material]};
}
function slimeGeometry(){
 const S=L.slime,lathe=new THREE.LatheGeometry(S.profile.map(([r,h])=>new THREE.Vector2(r,h)),S.segments);
 lathe.deleteAttribute('uv');lathe.deleteAttribute('normal');
 const g=mergeVertices(lathe),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(x,z),skirt=Math.max(0,1-y/S.lobeTop);
  const k=1+S.lobeAmount*Math.sin(a*S.lobes+1)*skirt;
  p.setXYZ(i,x*k,y,z*k*S.depth);
 }
 g.computeVertexNormals();return tint(g,K.slimeTop);
}
function slimeMouth(){
 const m=L.slime.mouth,smile=new THREE.TorusGeometry(m.radius,m.tube,...m.segments,m.arc);
 place(smile,...m.at,0,0,Math.PI+(Math.PI-m.arc)/2);
 return new THREE.Mesh(tint(smile,K.pupil),softMaterial({fuzz:0,gloss:E.gloss}));
}
function buildSlime(){
 const S=L.slime,group=new THREE.Group();
 const bubbles=new THREE.Mesh(merge(S.bubbles.map(([x,y,z,r])=>ellipsoid(S.bubbleSegments,[x,y,z,r,r,r],K.bubble))),bubbleMaterial());
 const jelly=new THREE.Mesh(slimeGeometry(),jellyMaterial(S.glass,{top:K.slimeTop,base:K.slimeBase,glint:K.glint},S.topY));
 bubbles.renderOrder=1;jelly.renderOrder=2;group.add(bubbles,jelly,slimeMouth());
 return {group,eyes:eyes(S.eyes,group),skin:[jelly.material,bubbles.material]};
}
const BUILD={puff:buildPuff,slime:buildSlime};

/** Turns, blinks and moves one neighbour each frame. The model owns its position; this only poses it. */
export function createNeighbourView(id,heading,radius){
 const built=BUILD[id](),{group}=built,look=L[id];group.rotation.order='YXZ';
 const pose={clock:0,yaw:heading,move:0,last:null};
 function face(s,reduced,walking,dt){
  const eye=G.uViewEye.value,toCamera=Math.atan2(eye.x-s.pos.x,eye.z-s.pos.z);
  if(reduced){pose.yaw=toCamera;return;}
  const dx=pose.last?s.pos.x-pose.last.x:0,dz=pose.last?s.pos.z-pose.last.z:0;
  const travelling=walking&&Math.hypot(dx,dz)>M.minStep;
  const want=travelling?faceYaw(Math.atan2(dx,dz),toCamera,M.maxOff):toCamera+(s.activity.phase==='idle'?M.idleAside:0);
  pose.yaw=turnToward(pose.yaw,want,M.turnRate*dt);
 }
 function shape(){
  const breath=squashStretch(pose.clock,M.breathPeriod[id],M.breathAmount[id]);
  if(id==='puff'){
   const hop=hopShape(pose.clock/look.hopPeriod,look.hopHeight,look.hopSquash);
   return {lift:hop.lift*pose.move,y:breath.y+(hop.y-1)*pose.move,xz:breath.xz-(hop.y-1)*pose.move/2};
  }
  const slide=squashStretch(pose.clock,look.slideJiggle.period,look.slideJiggle.amount);
  return {lift:0,y:breath.y+(slide.y-1)*pose.move,xz:breath.xz+(slide.xz-1)*pose.move};
 }
 function eyesPose(s,dt,reduced){
  const shut=reduced?0:blink(pose.clock,M.blinkPeriod[id],M.blinkLength)*M.blinkDepth;
  const atCamera=s.activity.phase==='look',ease=Math.min(1,M.gazeEase*dt),rattle=Math.sin(pose.clock*M.jiggleRate)*M.jiggleAmount*pose.move;
  for(const eye of built.eyes){
   const want=atCamera?{x:0,y:0}:eye.rest,k=reduced?1:ease;
   eye.gaze.x+=(want.x-eye.gaze.x)*k;eye.gaze.y+=(want.y-eye.gaze.y)*k;
   eye.lid.scale.y=1-shut;eye.look.rotation.set(-eye.gaze.y-rattle,eye.gaze.x+rattle*M.rattleSide,0);
  }
 }
 return {group,
  update(dt,s,reduced){
   const walking=s.activity.phase==='walk';
   if(!reduced){pose.clock+=dt;pose.move+=((walking?1:0)-pose.move)*Math.min(1,M.moveEase*dt);}
   face(s,reduced,walking,dt);pose.last={x:s.pos.x,z:s.pos.z};
   const b=shape();
   group.position.set(s.pos.x,s.pos.y-radius+b.lift,s.pos.z);
   group.scale.set(b.xz,b.y,b.xz);group.rotation.set(look.lean*pose.move,pose.yaw,0);
   if(id==='slime'){const u=built.skin[0].uniforms;u.uPhase.value=pose.clock*Math.PI*2/look.slideJiggle.period;u.uJiggle.value=look.jiggle*pose.move;}
   eyesPose(s,dt,reduced);
  },
 };
}
