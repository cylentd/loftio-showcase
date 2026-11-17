import {TRAVERSAL as T} from './traversal-constants.mjs';
/** @typedef {'ready'|'spent'|'settling'} ChargePhase */
export const initialCharge=()=>({phase:'ready',stable:0,supportId:0});
export function chargeTransition(s,e) {
  if(e.type==='reset'||e.type==='exit')return initialCharge();
  if(e.type==='release'&&s.phase==='ready')return {...s,phase:'spent',stable:0};
  if(e.type==='impact'&&e.incomingNormalSpeed>=T.contactSpeed)return {...s,phase:'ready',stable:0};
  if(e.type==='support-contact'&&Number.isInteger(e.id)&&e.id>s.supportId)return {...s,phase:'ready',stable:0,supportId:e.id};
  if(e.type!=='tick'||s.phase==='ready')return s;
  if(!e.grounded||e.speed>T.settleSpeed)return {...s,phase:'spent',stable:0};
  const stable=s.stable+e.dt;
  return {...s,stable,phase:stable>=T.settleTime?'ready':'settling'};
}
export function carryLaunch(velocity,shot) {
  const base=Math.hypot(shot.x,shot.y,shot.z);
  if(!base)return null;
  const d={x:shot.x/base,y:shot.y/base,z:shot.z/base};
  const helpful=Math.max(0,velocity.x*d.x+velocity.y*d.y+velocity.z*d.z);
  const speed=Math.min(base+Math.min(helpful*T.carryShare,T.carryMax),T.launchMax);
  return {x:d.x*speed,y:d.y*speed,z:d.z*speed};
}
