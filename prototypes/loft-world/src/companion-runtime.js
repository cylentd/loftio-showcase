import * as THREE from 'three';
import {bankAvailable,bankDirection,bankEnemy,initialSupport,nextSupport,followMotion,followShot,zipPoints} from './companion-model.mjs';
import {TEAM,CHOMPER_BANK,ZIP} from './teamwork-constants.mjs';
import {PLAY} from './play-constants.js';
import {validEnemyShot,counterOpen,counterEnemy,readEnemy} from './creature-model.mjs';

function assistTarget(target,lead,side) {
  target.copy(lead.pos);
  target.y-=side?CHOMPER_BANK.below:TEAM.below;
  if(side)target.addScaledVector(side,-CHOMPER_BANK.sideGap);
}

function moveBuddy({state,lead,buddy,dt,fwd,right,floorAt,stand,target,dir}) {
  if(state.phase==='assist') {
    const side=state.bankSide;
    assistTarget(target,lead,side);
    target.y=Math.max(target.y,floorAt(target.x,target.z)+PLAY.radius+TEAM.approachClearance);
    dir.subVectors(target,buddy.pos);
    const gap=dir.length();
    if(gap>(side?CHOMPER_BANK.range:TEAM.followRange)||lead.grounded)return false;
    if(gap>0)buddy.vel.copy(dir).multiplyScalar(Math.min(side?CHOMPER_BANK.approachSpeed:TEAM.approachSpeed,gap/Math.max(dt,TEAM.minStep))/gap);
    else if(side)buddy.vel.set(0,0,0);
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

export function createSupport({lead,buddy,monster,stand,sfx,floorAt=()=>-Infinity,onContact=()=>{},onSpit=()=>{},onBlink=()=>{}}) {
  let state=initialSupport();
  // focus: the enemy the camera frames after F, until Sprout flings, hits or lands; zip: the time left on the lap
  let bankTarget=null,focus=null,zip=0;
  const tuning={delay:TEAM.delay,boost:TEAM.boost};
  const target=new THREE.Vector3(),dir=new THREE.Vector3();
  const enemies=()=>monster.states??(monster.state?[monster.state]:[]);
  const focusEnemy=()=>focus&&!lead.grounded?enemies().find(item=>item.alive&&item.id===focus.id&&item.at===focus.at):null;
  const endZip=()=>{if(zip>0){zip=0;lead.propulsion=0;lead.vel.set(0,ZIP.exitLift,0);}};
  /** Steers Sprout along the zip route, recomputed every step so it follows a moving, turning enemy. */
  function steerZip(dt) {
    if(!(zip>0))return;
    // an attack that landed on Sprout (a gust, a shot) knocks him out of the zip; his shove stands
    if(lead.knocked){lead.knocked=false;zip=0;return;}
    const enemy=focusEnemy();
    zip-=dt;
    if(!enemy||zip<=0){endZip();return;}
    const route=zipPoints(lead.pos,enemy),last=route.at(-1);
    if(Math.hypot(last.x-lead.pos.x,last.y-lead.pos.y,last.z-lead.pos.z)<=ZIP.reach){endZip();return;}
    const next=route.find(p=>Math.hypot(p.x-lead.pos.x,p.y-lead.pos.y,p.z-lead.pos.z)>ZIP.reach)??last;
    dir.set(next.x-lead.pos.x,next.y-lead.pos.y,next.z-lead.pos.z);
    // never overshoot the stop in one step
    lead.vel.copy(dir).setLength(Math.min(ZIP.speed,dir.length()/Math.max(dt,TEAM.minStep)));
    lead.propulsion=Math.max(lead.propulsion||0,dt);
  }
  const history=[];
  const send=e=>{const old=state;state=nextSupport(state,e);if(old.phase!==state.phase)history.push({event:e.type,from:old.phase,to:state.phase,reason:e.reason});if(history.length>TEAM.historyLimit)history.shift();};
  const api={
    tuning,history,boosts:0,launches:0,chain:0,lastLaunch:null,lastContact:null,contactSerial:0,
    get state(){return state;},
    get canBank(){return !lead.grounded&&bankAvailable(state);},
    bankTarget(preferred){return api.canBank?bankEnemy(enemies(),lead.pos,preferred):null;},
    bank(forward,preferred){
      const enemy=api.bankTarget(preferred);
      if(!enemy)return false;
      bankTarget={id:enemy.id,at:enemy.at};
      // timed against a telegraph, F is a counter: the enemy stays locked and Sprout slips its attack.
      // Untimed, the enemy reads it and turns on him, so the zip ends at its side.
      if(counterOpen(enemy)){counterEnemy(enemy);lead.counter={id:enemy.id,at:enemy.at};}
      else{readEnemy(enemy);lead.counter=null;}
      if(lead.pos.distanceTo(buddy.pos)>CHOMPER_BANK.range){
        const from={...buddy.pos};
        // on Sprout's side nearest where Chomper was, just below him, blinkGap away in total
        const {blinkGap:gap,below}=CHOMPER_BANK;
        dir.set(buddy.pos.x-lead.pos.x,0,buddy.pos.z-lead.pos.z);
        if(dir.lengthSq()===0)dir.set(1,0,0);
        dir.setLength(Math.sqrt(gap*gap-below*below));
        buddy.pos.copy(lead.pos).add(dir);buddy.pos.y-=below;
        buddy.pos.y=Math.min(lead.pos.y,Math.max(buddy.pos.y,floorAt(buddy.pos.x,buddy.pos.z)+PLAY.radius));
        buddy.vel.set(0,0,0);buddy.isle=null;
        onBlink({from,to:{...buddy.pos}});
      }
      send({type:'bank',airborne:true,side:bankDirection(lead,buddy.pos,forward)});
      buddy.grounded=false;buddy.propulsion=0;buddy.dive=0;buddy.isle=null;
      return true;
    },
    reset(){send({type:'reset'});bankTarget=focus=null;zip=0;lead.counter=null;lead.knocked=false;buddy.propulsion=0;api.boosts=api.launches=api.chain=0;api.lastLaunch=api.lastContact=null;history.length=0;},
    steerZip,
    get zipping(){return zip>0;},
    /** A fling takes over: the zip and the framing end, and the fling's own velocity stands. */
    cancelBankStrike(){zip=0;focus=null;},
    /** Where the camera should frame after F: the zipped-around enemy, or null. */
    strikeFocus(){return focusEnemy()?.pos??null;},
    /** Any lead hit ends the zip and spends a counter; a counter or new-angle hit is a chain link and re-arms F and the boost.
     *  Returns 'counter', true for another link, or false. */
    claimCombo(hit){
      if(!hit)return false;
      zip=0;focus=null;lead.counter=null;
      if(!hit.link&&!hit.counter)return false;
      api.chain++;send({type:'combo'});
      return hit.counter?'counter':true;
    },
    cancel(){send({type:'cancel'});},
    landed(){send({type:'landed'});api.chain=0;zip=0;focus=null;lead.counter=null;},
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
      const side=state.bankSide;
      assistTarget(target,lead,side);
      if(!lead.grounded&&buddy.pos.distanceTo(target)<=(side?CHOMPER_BANK.contact:TEAM.contact)&&buddy.pos.y<lead.pos.y) {
        const enemy=side?bankEnemy(enemies(),lead.pos,bankTarget):null;
        if(side&&!enemy){send({type:'impact'});return;}
        send({type:'contact'});lead.dive=0;
        if(enemy){
          focus={id:enemy.id,at:enemy.at};zip=ZIP.maxTime;
          steerZip(0);
        }else{lead.vel.y=Math.max(lead.vel.y,tuning.boost);lead.propulsion=0;}
        buddy.propulsion=0;buddy.vel.multiplyScalar(TEAM.recoverCarry);if(!side)api.boosts++;sfx.jump();
        api.lastContact={type:'support-contact',id:++api.contactSerial,leader:{...lead.pos},companion:{...buddy.pos},boost:side?lead.vel.y:tuning.boost};
        if(enemy)Object.assign(api.lastContact,{bank:true,enemyId:enemy.id,counter:!!lead.counter});
        onContact(api.lastContact);
        if(enemy)onSpit({enemyId:enemy.id,at:enemy.at,from:{...lead.pos}});
      }else if(buddy.propulsion<=0&&!buddy.supportFloor)send({type:'impact',reason:{pos:{...buddy.pos},target:{...target},grounded:buddy.grounded,propulsion:buddy.propulsion}});
    },
  };
  return api;
}
