import * as THREE from 'three';
import {initialSupport,nextSupport,followMotion,followShot} from './companion-model.mjs';
import {TEAM} from './teamwork-constants.mjs';
import {PLAY} from './play-constants.js';
import {validEnemyShot} from './creature-model.mjs';

function moveBuddy({state,lead,buddy,dt,fwd,right,floorAt,stand,target,dir}) {
  if(state.phase==='assist') {
    target.copy(lead.pos).setY(lead.pos.y-TEAM.below);
    target.y=Math.max(target.y,floorAt(target.x,target.z)+PLAY.radius+TEAM.approachClearance);
    dir.subVectors(target,buddy.pos);
    const gap=dir.length();
    if(gap>TEAM.followRange||lead.grounded)return false;
    if(gap>0)buddy.vel.copy(dir).multiplyScalar(Math.min(TEAM.approachSpeed,gap/Math.max(dt,TEAM.minStep))/gap);
    buddy.grounded=false;buddy.propulsion=Math.min(dt*2,TEAM.approachTime);
  }else if(buddy.grounded&&(state.phase==='idle'||state.phase==='queued')) {
    // the play code may name the exact spot; otherwise the old slot behind the camera's view of the leader
    if(buddy.followTarget)target.copy(buddy.followTarget);
    else target.copy(lead.pos).addScaledVector(fwd,-TEAM.slotBack).addScaledVector(right,-TEAM.slotSide);
    const m=followMotion(buddy.pos,target,lead.grounded&&lead.isle===buddy.isle);
    buddy.walkVel.set(m.x*m.speed,0,m.z*m.speed);
    if(m.speed)stand(buddy,dt,dir.set(m.x,0,m.z),m.speed);else buddy.stride=0;
  }
  return true;
}

export function createSupport({lead,buddy,monster,stand,sfx,floorAt=()=>-Infinity,onContact=()=>{}}) {
  let state=initialSupport();
  const tuning={delay:TEAM.delay,boost:TEAM.boost};
  const target=new THREE.Vector3(),dir=new THREE.Vector3();
  const history=[];
  const send=e=>{const old=state;state=nextSupport(state,e);if(old.phase!==state.phase)history.push({event:e.type,from:old.phase,to:state.phase,reason:e.reason});if(history.length>TEAM.historyLimit)history.shift();};
  const api={
    tuning,history,boosts:0,launches:0,lastLaunch:null,lastContact:null,contactSerial:0,
    get state(){return state;},
    reset(){send({type:'reset'});buddy.propulsion=0;api.boosts=api.launches=0;api.lastLaunch=api.lastContact=null;history.length=0;},
    cancel(){send({type:'cancel'});},
    landed(){send({type:'landed'});},
    impact(){send({type:'impact'});},
    fling(selected){send({type:'fling',delay:tuning.delay,shot:{target:{...selected.target},power:selected.power,
      enemyId:selected.target.enemyId??'grumble',enemyGeneration:selected.target.radius?(selected.target.enemyGeneration??monster.state.at):null}});},
    jump(pressed){
      const was=state.phase;send({type:'jump',pressed,airborne:!lead.grounded});
      if(was!==state.phase&&state.phase==='assist'){buddy.grounded=false;buddy.propulsion=0;buddy.dive=0;}
    },
    update(dt,fwd,right){
      const previous=state.phase,shot=state.shot;
      const valid=validEnemyShot(shot,monster.states??[{...monster.state,id:'grumble'}]);
      send({type:'tick',dt,valid});
      if(previous==='queued'&&state.phase==='flight') {
        const launch=followShot(shot,buddy.pos,buddy.grounded,PLAY.flingSpeed);
        if(launch){
          api.lastLaunch={origin:{...buddy.pos},...launch};api.launches++;
          buddy.vel.copy(launch.velocity);buddy.propulsion=launch.duration;buddy.grounded=false;buddy.dive=0;
        }else send({type:'impact'});
      }
      if(!moveBuddy({state,lead,buddy,dt,fwd,right,floorAt,stand,target,dir}))send({type:'impact'});
    },
    afterPhysics(){
      if(state.phase==='flight'&&buddy.propulsion<=0)send({type:'impact'});
      if(state.phase!=='assist')return;
      target.copy(lead.pos).setY(lead.pos.y-TEAM.below);
      if(!lead.grounded&&buddy.pos.distanceTo(target)<=TEAM.contact&&buddy.pos.y<lead.pos.y) {
        send({type:'contact'});lead.vel.y=Math.max(lead.vel.y,tuning.boost);lead.propulsion=0;lead.dive=0;
        buddy.propulsion=0;buddy.vel.multiplyScalar(TEAM.recoverCarry);api.boosts++;sfx.jump();
        api.lastContact={type:'support-contact',id:++api.contactSerial,leader:{...lead.pos},companion:{...buddy.pos},boost:tuning.boost};
        onContact(api.lastContact);
      }else if(buddy.propulsion<=0&&!buddy.supportFloor)send({type:'impact',reason:{pos:{...buddy.pos},target:{...target},grounded:buddy.grounded,propulsion:buddy.propulsion}});
    },
  };
  return api;
}
