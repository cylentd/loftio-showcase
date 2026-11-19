import {CREATURE as C,NEIGHBOURS} from './creature-constants.mjs';
import {sweepSphere} from './contact-model.mjs';
import {sweepProp} from './terrain-props.mjs';
/** @typedef {{phase:'wait'|'move'|'defeated',remaining:number,leg:number}} Patrol */
export const initialPatrol=(delay=C.wait)=>({phase:'wait',remaining:delay,leg:0});
export function nextPatrol(s,e){
 if(e.type==='reset')return initialPatrol(e.delay);
 if(e.type==='defeat')return {...s,phase:'defeated',remaining:0};
 if(s.phase==='defeated'||e.type!=='tick')return s;
 const remaining=s.remaining-e.dt;if(remaining>0)return {...s,remaining};
 return s.phase==='wait'?{...s,phase:'move',remaining:e.travel??C.travel}:{phase:'wait',remaining:e.wait??C.wait,leg:s.leg+1};
}
export function safeStep(from,to,radius,world,home){
 if(Math.hypot(to.x-home.x,to.z-home.z)>home.r)return false;
 const lake=world.lake,steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/C.probeStep));
 for(let i=0;i<=steps;i++){
  const t=i/steps,x=from.x+(to.x-from.x)*t,z=from.z+(to.z-from.z)*t;
  if(lake&&Math.hypot(x-lake.x,z-lake.z)<lake.r+radius)return false;
  for(const [sx,sz,r] of world.solids??[])if(Math.hypot(x-sx,z-sz)<r+radius)return false;
  for(const rock of world.rocks??[])if(Math.hypot(x-rock.g.position.x,z-rock.g.position.z)<rock.r+radius)return false;
  const h=world.terrain.heightAt(x,z);if(!Number.isFinite(h)||Math.abs(h-world.terrain.heightAt(from.x,from.z))>C.maxSlope+Math.hypot(x-from.x,z-from.z))return false;
 }
 for(const prop of world.terrainProps??[]){
  if(sweepProp(from,to,radius,prop))return false;
  if(prop.planes.every(p=>p.normal.x*to.x+p.normal.y*to.y+p.normal.z*to.z-p.offset<radius))return false;
 }
 return true;
}
/** A hit is a new angle when its contact normal turned at least 60 degrees from the last hit's; the top counts. */
export function newAngle(last,normal){
 if(!last)return false;
 const a=Math.hypot(last.x,last.y,last.z),b=Math.hypot(normal.x,normal.y,normal.z);
 return a>0&&b>0&&(last.x*normal.x+last.y*normal.y+last.z*normal.z)/(a*b)<=C.linkAngleCos;
}
/** F counters while the enemy telegraphs (stomp crouch, headbutt rear-back, gust swell, Drift's shot wind-up) or follows through an attack. */
export function counterOpen(enemy){return !!enemy&&(winding(enemy)||(enemy.opening??0)>0||!!enemy.aiming);}
/** True while a stomp, headbutt or gust is winding up. */
export function winding(enemy){return (enemy.wind??-1)>=0||(enemy.bonkWind??-1)>=0||(enemy.gustWind??-1)>=0;}
/** A countered enemy stays locked in its swing while Chomper zips Sprout round to its back. */
export function counterEnemy(enemy){enemy.commit=Math.max(enemy.commit??0,C.counterLock);enemy.read=0;}
/** An untimed F is read: the enemy shakes off its stagger and turns on Sprout; a floater gusts as soon as he is near. */
export function readEnemy(enemy){enemy.read=C.readTime;enemy.commit=0;if(enemy.floats)enemy.gust=Math.min(enemy.gust??0,0);}
const clamp01=x=>Math.min(Math.max(x,0),1);
/** Damage multiplier for a diving hit by how far Sprout fell: 1 up to dropMin, rising to dropCap. */
export function dropBonus(fall){return 1+clamp01((fall-C.dropMin)/(C.dropCap-C.dropMin))*(C.dropCap-C.dropMin)*C.dropPerUnit;}
/** 0..1 strength of a Skyfall's ground shockwave: 0 below slamMin, 1 at dropCap. */
export function slamPower(fall){return clamp01((fall-C.slamMin)/(C.dropCap-C.slamMin));}
/** How far the shockwave reaches along the ground. */
export function slamReach(power){return C.slamRange[0]+(C.slamRange[1]-C.slamRange[0])*power;}
export function safeHome(def,radius,world){
 for(let i=0;i<C.homeSearch;i++){
  const angle=i*C.goldenAngle,distance=Math.sqrt(i)*C.homeStep;
  const x=def.x+Math.cos(angle)*distance,z=def.z+Math.sin(angle)*distance;
  const p={x,y:world.terrain.heightAt(x,z)+radius,z};
  if(safeStep(p,p,radius,world,{x,z,r:0}))return {...p,r:C.bounds};
 }
 return null;
}
export function contextualEnemy(enemies,id,origin){
 const alive=enemies.filter(s=>s.alive),aimed=alive.find(s=>s.id===id);if(aimed)return aimed;
 return alive.filter(s=>Math.hypot(s.pos.x-origin.x,s.pos.z-origin.z)<C.notice)
  .sort((a,b)=>Number(!!b.engaged)-Number(!!a.engaged)||Math.hypot(a.pos.x-origin.x,a.pos.z-origin.z)-Math.hypot(b.pos.x-origin.x,b.pos.z-origin.z))[0]??null;
}
export function validEnemyShot(shot,enemies){
 if(!shot||shot.enemyGeneration==null)return true;
 const enemy=enemies.find(s=>s.id===(shot.enemyId??'grumble'));
 return !!enemy?.alive&&enemy.at===shot.enemyGeneration;
}
export function movingContact(from,to,oldCenter,center,radius){
 const relative={x:from.x+center.x-oldCenter.x,y:from.y+center.y-oldCenter.y,z:from.z+center.z-oldCenter.z};
 return sweepSphere(relative,to,center,radius);
}
export function patrolPosition(s,home,dt,speed,world,radius){
 const angle=(s.heading??0)+s.patrol.leg*C.goldenAngle;
 const candidate={x:s.pos.x+Math.sin(angle)*speed*dt,y:s.pos.y,z:s.pos.z+Math.cos(angle)*speed*dt};
 candidate.y=world.terrain.heightAt(candidate.x,candidate.z)+radius;
 return safeStep(s.pos,candidate,radius,world,home)?candidate:null;
}
/** @typedef {{phase:'idle'|'look'|'walk',remaining:number,leg:number}} NeighbourActivity */
export function nextNeighbour(s,dt){
 const remaining=s.remaining-dt;if(remaining>0)return {...s,remaining};
 if(s.phase==='idle')return {...s,phase:'look',remaining:C.npcLook};
 if(s.phase==='look')return {...s,phase:'walk',remaining:C.npcTravel};
 return {phase:'idle',remaining:C.npcWait,leg:s.leg+1};
}
export function initialNeighbours(world){return NEIGHBOURS.map(d=>{
 const home=safeHome(d,C.npcRadius,world);return {id:d.id,heading:d.heading,home:home&&{...home,r:d.r},pos:home?{x:home.x,y:home.y,z:home.z}:{x:d.x,y:0,z:d.z},activity:{phase:'idle',remaining:d.delay,leg:0},visible:!!home};
});}
export function stepNeighbour(s,dt,world,reduced){
 if(reduced||!s.visible)return s;const activity=nextNeighbour(s.activity,dt);
 if(activity.phase!=='walk')return {...s,activity};
 const pos=patrolPosition({...s,patrol:activity},s.home,dt,C.npcSpeed,world,C.npcRadius);
 return pos?{...s,pos,activity}:{...s,activity:{phase:'idle',remaining:C.npcWait,leg:activity.leg+1}};
}
export function enemyFrameDistance(distance,enemies,origin){
 return distance+Math.max(0,...enemies.filter(e=>e.alive&&Math.hypot(e.pos.x-origin.x,e.pos.z-origin.z)<C.frameRange).map(e=>e.radius*C.frameScale));
}
