import { AIM, TREE_BANK } from './control-constants.mjs';
import {rayProps} from './terrain-props.mjs';
import {impulse,sweepSphere} from './contact-model.mjs';
import {carryLaunch} from './traversal-model.mjs';
import {TRAVERSAL} from './traversal-constants.mjs';

export function directVelocity({ origin, target, power, pixels, speed, cool = 0, cancelled = false, grounded = false }) {
  if (!target || cancelled || cool > 0 || pixels < AIM.deadPixels) return null;
  const x = target.x-origin.x, y = grounded ? Math.max(0,target.y-origin.y) : target.y-origin.y, z = target.z-origin.z;
  const length = Math.hypot(x,y,z);
  if (!Number.isFinite(length) || length === 0) return null;
  const scale = speed/length;
  return {x:x*scale,y:y*scale,z:z*scale};
}

export function sphereEntry(origin, direction, center, radius) {
  const x=origin.x-center.x,y=origin.y-center.y,z=origin.z-center.z;
  const b=x*direction.x+y*direction.y+z*direction.z, c=x*x+y*y+z*z-radius*radius;
  const d=b*b-c;
  if(d<0 || -b+Math.sqrt(d)<0) return null;
  return Math.max(0,-b-Math.sqrt(d));
}

const along=(origin,direction,distance)=>({x:origin.x+direction.x*distance,y:origin.y+direction.y*distance,z:origin.z+direction.z*distance});

export function previewBank({origin,velocity,canopy,radius,heightAt,blockers=[],props=[]}) {
  const travel=Math.hypot(velocity.x,velocity.y,velocity.z);
  if(!travel)return null;
  const direction={x:velocity.x/travel,y:velocity.y/travel,z:velocity.z/travel};
  const reach=travel*TREE_BANK.propulsion*TREE_BANK.reachShare;
  const end=along(origin,direction,reach);
  const hit=sweepSphere(origin,end,canopy.pos,canopy.radius+radius);
  if(!hit||hit.t===0)return null;
  const distance=hit.t*reach;
  if(rayProps(origin,direction,props,distance))return null;
  if(blockers.some(blocker=>{
    const contact=sweepSphere(origin,hit.point,blocker.pos,blocker.radius+radius);
    return contact&&contact.t<1;
  }))return null;
  for(let step=0;step<distance;step+=AIM.rayStep){
    const point=along(origin,direction,step);
    if(point.y<=heightAt(point.x,point.z)+radius)return null;
  }
  if(hit.point.y<=heightAt(hit.point.x,hit.point.z)+radius)return null;
  const bounce=impulse(velocity,hit.normal,'foliage');
  if(bounce.incomingNormalSpeed<TRAVERSAL.contactSpeed)return null;
  const marker=along(hit.point,hit.normal,-radius);
  return {contact:hit.point,marker,exit:along(hit.point,treeKick(bounce.outgoing),TREE_BANK.previewTime)};
}

/** A tree bank launches Sprout upward at least at the kick speed, so the bank opens a dive. */
export function treeKick(velocity) {
  return {x:velocity.x,y:Math.max(velocity.y,TREE_BANK.kick),z:velocity.z};
}

function pickCanopy(origin,direction,bank,nearest,candidates,radius,heightAt,props) {
  let soft=null;
  const alive=candidates.filter(candidate=>candidate.alive);
  for(const canopy of bank.canopies){
    const direct=sphereEntry(origin,direction,canopy.pos,canopy.radius);
    const distance=direct??sphereEntry(origin,direction,canopy.pos,canopy.radius*TREE_BANK.snapRadius);
    if(!distance||distance>AIM.rayRange||(nearest&&(direct===null||distance>=nearest.distance)))continue;
    const point=along(origin,direction,distance);
    const dx=point.x-canopy.pos.x,dy=point.y-canopy.pos.y,dz=point.z-canopy.pos.z;
    const scale=direct===null ? canopy.radius*TREE_BANK.surfaceBias/Math.hypot(dx,dy,dz) : 1;
    const target={x:canopy.pos.x+dx*scale,y:canopy.pos.y+dy*scale,z:canopy.pos.z+dz*scale,bankId:canopy.id};
    const shot=directVelocity({origin:bank.origin,target,speed:bank.speed,pixels:AIM.deadPixels});
    const blockers=[...alive,...bank.canopies.filter(other=>other!==canopy)];
    if(!shot||!previewBank({origin:bank.origin,velocity:carryLaunch(bank.velocity,shot),canopy,radius,heightAt,blockers,props}))continue;
    if(direct!==null)nearest={distance,target};
    else if(!soft||distance<soft.distance)soft={distance,target};
  }
  return nearest??soft;
}

export function pickTarget(origin, direction, monster, heightAt, radius, props=[], bank) {
  const point=distance=>along(origin,direction,distance);
  const candidates=Array.isArray(monster)?monster:[monster];
  const hits=candidates.filter(m=>m.alive).map(m=>({m,d:sphereEntry(origin,direction,m.pos,m.radius)})).filter(h=>h.d!==null).sort((a,b)=>a.d-b.d);
  monster=hits[0]?.m??{alive:false};
  const hit=hits[0]?.d??null;
  const prop=rayProps(origin,direction,props,AIM.rayRange);
  let nearest=prop&&(hit===null||prop.distance<hit)?{distance:prop.distance,target:{...prop.point,contactId:prop.id}}:hit!==null?{distance:hit,target:{...monster.pos,radius:monster.radius,...(monster.id?{enemyId:monster.id,enemyGeneration:monster.at}:{})}}:null;
  if(bank)nearest=pickCanopy(origin,direction,bank,nearest,candidates,radius,heightAt,props);
  for(let t=0;t<=AIM.rayRange;t+=AIM.rayStep) {
    const p=point(t);
    if(p.y<=heightAt(p.x,p.z)) return nearest&&nearest.distance<t ? nearest.target : {...p,y:heightAt(p.x,p.z)+radius};
  }
  return nearest ? nearest.target : point(AIM.skyRange);
}
