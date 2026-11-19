import {TEAM,CHOMPER_BANK,ZIP} from './teamwork-constants.mjs';
export {newAngle} from './creature-model.mjs';
import {AIM} from './control-constants.mjs';
import {directVelocity} from './aim-model.mjs';
import {shoreRadius,LEASH} from './shore.mjs';
/** The companion stops following past where the wind leash starts pulling home (shore.mjs), so he never trots off the island. */
const offIsland=({x,z})=>Math.hypot(x,z)>shoreRadius(x,z)+LEASH.free;
/** @typedef {{phase:'idle'|'queued'|'flight'|'assist'|'recover',remaining:number,shot:object|null,used:boolean}} Support */
export const initialSupport = () => ({phase:'idle',remaining:0,shot:null,used:false,bankUsed:false,bankSide:null});
export const bankAvailable = s => !s.bankUsed&&s.phase!=='assist'&&s.phase!=='recover';
export function nextSupport(s,e) {
  const idle=()=>({...s,phase:'idle',remaining:0,shot:null,bankSide:null});
  const recover=()=>({...idle(),phase:'recover',remaining:TEAM.recoverTime});
  switch(e.type) {
    case 'reset': case 'exit': return initialSupport();
    case 'landed': return {...(s.phase==='assist'?recover():s),used:false,bankUsed:false};
    case 'cancel': return s.phase==='queued'?idle():s;
    case 'impact': return s.phase==='flight'||s.phase==='assist'?recover():s;
    case 'fling':
      if(s.phase==='assist'||s.phase==='recover'||!e.shot?.target)return s;
      return {...s,phase:'queued',remaining:e.delay??TEAM.delay,shot:{...e.shot,target:{...e.shot.target}}};
    case 'jump':
      if(!e.pressed||!e.airborne||s.used||s.phase==='assist'||s.phase==='recover')return s;
      return {...idle(),phase:'assist',remaining:TEAM.approachTime};
    case 'bank':
      if(!e.airborne||!e.side||!bankAvailable(s))return s;
      return {...idle(),phase:'assist',remaining:CHOMPER_BANK.approachTime,bankSide:{...e.side}};
    // a hit from a new angle re-arms both the zip (F) and the boost (Space) in the air, so you keep circling
    case 'combo': return {...(s.phase==='recover'?idle():s),bankUsed:false,used:false};
    case 'contact':
      if(s.phase!=='assist')return s;
      return s.bankSide?{...recover(),bankUsed:true}:{...recover(),used:true};
    case 'tick': {
      if(s.phase==='idle')return s;
      if(s.phase==='queued'&&!e.valid)return idle();
      const remaining=Math.max(0,s.remaining-e.dt);
      if(remaining>0)return {...s,remaining};
      if(s.phase==='queued')return {...s,phase:'flight',remaining:AIM.propulsion};
      return s.phase==='assist'?recover():idle();
    }
    default:return s;
  }
}

export function bankDirection(lead,buddy,forward) {
  const speed=Math.hypot(lead.vel.x,lead.vel.z);
  const x=speed>=CHOMPER_BANK.minHeadingSpeed?lead.vel.x/speed:forward.x;
  const z=speed>=CHOMPER_BANK.minHeadingSpeed?lead.vel.z/speed:forward.z;
  const sign=(buddy.x-lead.pos.x)*z-(buddy.z-lead.pos.z)*x>0?-1:1;
  return {x:z*sign,y:0,z:-x*sign};
}

/**
 * Flank zip route: stops on a circle just outside the enemy, from Sprout's bearing round the short way to its
 * back (bearing yaw+π, where a walker's weak spot is), in steps small enough that no chord cuts the body.
 * A floater's weak spot is on top, so its route is one stop above it.
 */
export function zipPoints(from,enemy) {
  const out=(enemy.radius??0)+ZIP.gap,{x,y,z}=enemy.pos;
  if(enemy.floats)return [{x,y:y+out,z}];
  const start=Math.atan2(from.x-x,from.z-z),back=(enemy.yaw??0)+Math.PI;
  let turn=(back-start)%(2*Math.PI);
  if(turn>Math.PI)turn-=2*Math.PI;else if(turn<=-Math.PI)turn+=2*Math.PI;
  const steps=Math.max(1,Math.ceil(Math.abs(turn)/ZIP.step)),route=[];
  for(let k=0;k<=steps;k++){const a=start+turn*k/steps;route.push({x:x+Math.sin(a)*out,y,z:z+Math.cos(a)*out});}
  return route;
}
export function bankEnemy(enemies,origin,preferred) {
  let nearest=null,range=CHOMPER_BANK.range;
  for(const enemy of enemies){
    if(!enemy.alive)continue;
    // measured to the surface, so a giant's reach starts at its skin, not its far-off center
    const gap=Math.hypot(enemy.pos.x-origin.x,enemy.pos.y-origin.y,enemy.pos.z-origin.z)-(enemy.radius??0);
    if(gap>CHOMPER_BANK.range)continue;
    if(preferred&&enemy.id===preferred.id&&enemy.at===preferred.at)return enemy;
    if(!nearest||gap<range){nearest=enemy;range=gap;}
  }
  return nearest;
}
export function followMotion(origin,target,sameSurface) {
  const x=target.x-origin.x,z=target.z-origin.z,gap=Math.hypot(x,z);
  if(!sameSurface||gap<=TEAM.stopGap||gap>TEAM.followRange||offIsland(origin))return {x:0,z:0,speed:0};
  return {x:x/gap,z:z/gap,speed:Math.min(TEAM.followSpeed,gap*TEAM.followGain)};
}
export function followShot(shot,origin,grounded,speed) {
  const velocity=directVelocity({origin,...shot,pixels:AIM.deadPixels,speed,grounded});
  if(!velocity)return null;
  const distance=Math.hypot(shot.target.x-origin.x,shot.target.y-origin.y,shot.target.z-origin.z);
  return {velocity,target:{...shot.target},duration:Math.min(AIM.propulsion,distance/Math.hypot(velocity.x,velocity.y,velocity.z))};
}
