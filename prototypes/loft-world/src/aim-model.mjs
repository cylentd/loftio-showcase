import { AIM } from './control-constants.mjs';
import {rayProps} from './terrain-props.mjs';

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

export function pickTarget(origin, direction, monster, heightAt, radius, props=[]) {
  const point=t=>({x:origin.x+direction.x*t,y:origin.y+direction.y*t,z:origin.z+direction.z*t});
  const candidates=Array.isArray(monster)?monster:[monster];
  const hits=candidates.filter(m=>m.alive).map(m=>({m,d:sphereEntry(origin,direction,m.pos,m.radius)})).filter(h=>h.d!==null).sort((a,b)=>a.d-b.d);
  monster=hits[0]?.m??{alive:false};
  const hit=hits[0]?.d??null;
  const prop=rayProps(origin,direction,props,AIM.rayRange);
  const nearest=prop&&(hit===null||prop.distance<hit)?{distance:prop.distance,target:{...prop.point,contactId:prop.id}}:hit!==null?{distance:hit,target:{...monster.pos,radius:monster.radius,...(monster.id?{enemyId:monster.id,enemyGeneration:monster.at}:{})}}:null;
  for(let t=0;t<=AIM.rayRange;t+=AIM.rayStep) {
    const p=point(t);
    if(p.y<=heightAt(p.x,p.z)) return nearest&&nearest.distance<t ? nearest.target : {...p,y:heightAt(p.x,p.z)+radius};
  }
  return nearest ? nearest.target : point(AIM.skyRange);
}
