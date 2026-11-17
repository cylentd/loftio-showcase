import * as THREE from 'three';
import {createMonster,MONSTER} from './monster.js';
import {CREATURE as C,ENEMIES} from './creature-constants.mjs';
import {CREATURE_COPY} from './creature-copy.mjs';
import {NPC_ANCHORS} from '../assets/neighbours/anchors.mjs';
import {contextualEnemy,initialNeighbours,stepNeighbour} from './creature-model.mjs';

function shadow(scene,radius){
 const mesh=new THREE.Mesh(new THREE.CircleGeometry(radius,C.shadowSegments),new THREE.MeshBasicMaterial({color:C.shadowColor,transparent:true,opacity:C.shadowOpacity,depthWrite:false}));
 mesh.rotation.x=-Math.PI/2;scene.add(mesh);return mesh;
}
export function createEnemies(options){
 const items=ENEMIES.map(definition=>createMonster({...options,definition:{...definition,name:CREATURE_COPY[definition.id]}}));
 const shadows=items.map(e=>shadow(options.scene,e.state.radius));let active=false;
 const api={items,get state(){return items[0].state;},get states(){return items.map(e=>e.state);},
  reset(){for(const e of items)e.reset();},
  setVisible(on){active=on;items.forEach(e=>e.setVisible(on));shadows.forEach(s=>s.visible=on);},
  touch(...args){let damage=0;for(const e of items)damage+=e.touch(...args);return damage;},
  pop(...args){let caught=0;for(const e of items)if(e.pop(...args))caught++;return caught;},
  update(dt,time,bodies){if(active)for(const e of items)e.update(dt,time,bodies);},
  draw(selected,lead){
   for(const [i,e] of items.entries()){const s=e.state;shadows[i].visible=active&&s.alive;shadows[i].position.set(s.pos.x,options.world.terrain.heightAt(s.pos.x,s.pos.z)+C.shadowHeight,s.pos.z);}
   const chosen=active?contextualEnemy(api.states,selected?.target?.enemyId,lead.pos):null;
   options.hud.boss(chosen?chosen.hp/MONSTER.health:null,chosen?.name);
  },
 };
 api.setVisible(false);return api;
}
export function createNeighbours({scene,world}){
 let states=initialNeighbours(world),active=false;
 const loader=new THREE.TextureLoader();
 const views=states.map(s=>{
  const texture=loader.load(`./assets/neighbours/${s.id}.png`);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,alphaTest:.1}));
  sprite.center.set(...NPC_ANCHORS[s.id]);sprite.scale.set(C.npcSize,C.npcSize,1);scene.add(sprite);
  return {sprite,shadow:shadow(scene,C.npcRadius)};
 });
 const api={get states(){return states;},
  reset(){states=initialNeighbours(world);},
  setVisible(on){active=on;for(const [i,v] of views.entries())v.sprite.visible=v.shadow.visible=on&&states[i].visible;},
  update(dt,reduced){
   if(!active)return;
   states=states.map(s=>stepNeighbour(s,dt,world,reduced));
   for(const [i,s] of states.entries()){
    const v=views[i];v.sprite.position.set(s.pos.x,s.pos.y-C.npcRadius,s.pos.z);
    v.shadow.position.set(s.pos.x,s.pos.y-C.npcRadius+C.shadowHeight,s.pos.z);
   }
  },
 };
 api.setVisible(false);return api;
}
