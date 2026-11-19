export const SHOT = {windup: 1.1, cooldown: 4.8, speed: 17, lifetime: 4, radius: .65, range: 65, push: 14, lift: 8};
export function createShots() {return {phase:'idle',remaining:0,direction:null,shots:[],serial:0};}
export function updateShots(state, dt, enemy, player, floorAt, blockedAt=()=>Infinity) {
  if (!enemy?.alive) {Object.assign(state,createShots());if(enemy)enemy.aiming=false;return [];}
  const hits=[];
  state.shots=state.shots.filter(shot=>{
    const previous={...shot.pos};shot.life-=dt;
    for(const axis of ['x','y','z'])shot.pos[axis]+=shot.direction[axis]*SHOT.speed*dt;
    if(shot.life<=0)return false;
    // a countering Sprout (F timed against the wind-up) slips the shot: it flies on through him
    const contact=!player.dodge&&sweepSphere(previous,shot.pos,player.pos,player.radius+SHOT.radius);
    const obstruction=blockedAt(previous,shot.pos);
    if(contact && contact.t<obstruction){
      hits.push({id:shot.id,direction:{...shot.direction}});return false;
    }
    if(obstruction<=1 || shot.pos.y<=floorAt(shot.pos.x,shot.pos.z)+SHOT.radius)return false;
    return true;
  });
  state.remaining-=dt;
  if(enemy.stun>0){state.phase='idle';state.remaining=SHOT.cooldown;enemy.aiming=false;return hits;}
  if(state.phase==='windup') {
    if(state.remaining<=0){
      state.shots.push({id:++state.serial,pos:{...enemy.pos},direction:{...state.direction},life:SHOT.lifetime});
      state.phase='idle';state.remaining=SHOT.cooldown;enemy.commit=Math.max(enemy.commit||0,SHOT.windup);
    }
  } else if(state.remaining<=0 && enemy.engaged){
    const delta={x:player.pos.x-enemy.pos.x,y:player.pos.y-enemy.pos.y,z:player.pos.z-enemy.pos.z};
    const distance=Math.hypot(delta.x,delta.y,delta.z);
    if(distance>0 && distance<SHOT.range){
      state.direction={x:delta.x/distance,y:delta.y/distance,z:delta.z/distance};
      state.phase='windup';state.remaining=SHOT.windup;enemy.commit=Math.max(enemy.commit||0,SHOT.windup);
    }
  }
  enemy.aiming=state.phase==='windup'; // the telegraph: F now is a counter
  return hits;
}
import {sweepSphere} from './contact-model.mjs';
