import {TEAM} from './teamwork-constants.mjs';
import {AIM} from './control-constants.mjs';
import {directVelocity} from './aim-model.mjs';
/** @typedef {{phase:'idle'|'queued'|'flight'|'assist'|'recover',remaining:number,shot:object|null,used:boolean}} Support */
export const initialSupport = () => ({phase:'idle',remaining:0,shot:null,used:false});
export function nextSupport(s,e) {
  const idle=()=>({...s,phase:'idle',remaining:0,shot:null});
  const recover=()=>({...idle(),phase:'recover',remaining:TEAM.recoverTime});
  switch(e.type) {
    case 'reset': case 'exit': return initialSupport();
    case 'landed': return {...(s.phase==='assist'?recover():s),used:false};
    case 'cancel': return s.phase==='queued'?idle():s;
    case 'impact': return s.phase==='flight'||s.phase==='assist'?recover():s;
    case 'fling':
      if(s.phase==='assist'||s.phase==='recover'||!e.shot?.target)return s;
      return {...s,phase:'queued',remaining:e.delay??TEAM.delay,shot:{...e.shot,target:{...e.shot.target}}};
    case 'jump':
      if(!e.pressed||!e.airborne||s.used||s.phase==='assist'||s.phase==='recover')return s;
      return {...idle(),phase:'assist',remaining:TEAM.approachTime};
    case 'contact': return s.phase==='assist'?{...recover(),used:true}:s;
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
export function followMotion(origin,target,sameSurface) {
  const x=target.x-origin.x,z=target.z-origin.z,gap=Math.hypot(x,z);
  if(!sameSurface||gap<=TEAM.stopGap||gap>TEAM.followRange||Math.hypot(origin.x,origin.z)>TEAM.leash)return {x:0,z:0,speed:0};
  return {x:x/gap,z:z/gap,speed:Math.min(TEAM.followSpeed,gap*TEAM.followGain)};
}
export function followShot(shot,origin,grounded,speed) {
  const velocity=directVelocity({origin,...shot,pixels:AIM.deadPixels,speed,grounded});
  if(!velocity)return null;
  const distance=Math.hypot(shot.target.x-origin.x,shot.target.y-origin.y,shot.target.z-origin.z);
  return {velocity,target:{...shot.target},duration:Math.min(AIM.propulsion,distance/Math.hypot(velocity.x,velocity.y,velocity.z))};
}
