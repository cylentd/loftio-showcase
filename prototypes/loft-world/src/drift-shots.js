import * as THREE from 'three';
import {createShots, updateShots, SHOT} from './drift-shot-model.mjs';
import {sweepSphere} from './contact-model.mjs';
import {sweepProp} from './terrain-props.mjs';

const VIEW={pool:4,size:2.8,warningSize:4,color:'#b9f7f1',warning:'#ffd59b'};
export function createDriftShots({scene,glow,lead,monster,world,floorAt,puff,sfx}) {
  const state=createShots();
  const orb=color=>{
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,color,transparent:true,depthWrite:false}));
    sprite.visible=false;scene.add(sprite);return sprite;
  };
  const shots=Array.from({length:VIEW.pool},()=>orb(VIEW.color)),warning=orb(VIEW.warning);
  const blockedAt=(from,to)=>{
    let earliest=Infinity;
    for(const prop of world.terrainProps??[])earliest=Math.min(earliest,sweepProp(from,to,SHOT.radius,prop)?.t??Infinity);
    for(const [x,z,radius,top] of world.solids){
      const hit=sweepSphere({...from,y:0},{...to,y:0},{x,y:0,z},radius+SHOT.radius);
      if(hit){const height=from.y+(to.y-from.y)*hit.t;
        if(height>=world.terrain.heightAt(x,z)-SHOT.radius && height<=top+SHOT.radius)earliest=Math.min(earliest,hit.t);
      }
    }
    const samples=8;
    for(let sample=0;sample<=samples;sample++){
      const fraction=sample/samples,x=from.x+(to.x-from.x)*fraction,z=from.z+(to.z-from.z)*fraction;
      if(from.y+(to.y-from.y)*fraction<=floorAt(x,z)+SHOT.radius){earliest=Math.min(earliest,fraction);break;}
    }
    return earliest;
  };
  return {
    state,
    reset(){Object.assign(state,createShots());warning.visible=false;for(const shot of shots)shot.visible=false;},
    update(dt){
      const enemy=monster.states.find(value=>value.id==='drift');
      const before=state.serial;
      const hits=updateShots(state,dt,enemy,{pos:lead.pos,radius:1.1,dodge:!!lead.counter},floorAt,blockedAt);
      if(state.serial>before)sfx.rustle?.();
      for(const hit of hits){
        lead.vel.set(hit.direction.x*SHOT.push,Math.max(lead.vel.y,SHOT.lift),hit.direction.z*SHOT.push);
        lead.grounded=false;lead.propulsion=0;lead.squash=.6;lead.knocked=true;
        puff(lead.pos,VIEW.warningSize,VIEW.color);sfx.hit(.4,1);
      }
      warning.visible=state.phase==='windup';
      if(warning.visible){
        warning.position.copy(enemy.pos).addScaledVector(new THREE.Vector3().copy(state.direction),enemy.radius);
        warning.scale.setScalar(VIEW.warningSize*(1-state.remaining/SHOT.windup));
      }
      shots.forEach((sprite,index)=>{
        const shot=state.shots[index];sprite.visible=!!shot;
        if(shot){sprite.position.copy(shot.pos);sprite.scale.setScalar(VIEW.size);}
      });
    },
  };
}
