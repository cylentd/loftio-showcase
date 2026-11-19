import * as THREE from 'three';
import { AIM, TREE_BANK } from './control-constants.mjs';
import { directVelocity, pickTarget, previewBank } from './aim-model.mjs';
import { carryLaunch } from './traversal-model.mjs';
import { MONSTER } from './monster.js';

export function createAim({scene,camera,lead,state,floorAt,radius,speed,glow,props=[],canopies=[],lockable=()=>[]}) {
  const ray=new THREE.Raycaster();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(AIM.dots*3),3));
  // The marker draws over scenery (nothing is cut away now, so a tree can sit between the camera and the target):
  // no depth test, and a late render order so it lands after the transparent trees. The HUD is DOM, so it stays above.
  const material=new THREE.PointsMaterial({map:glow,size:AIM.dotSize,transparent:true,depthWrite:false,depthTest:false,color:'#ffe6a0'});
  const dots=new THREE.Points(geometry,material);dots.frustumCulled=false;dots.visible=false;dots.renderOrder=AIM.renderOrder;scene.add(dots);
  const bankDots=new THREE.Points(geometry.clone(),material.clone());
  bankDots.material.color.set(TREE_BANK.color);bankDots.frustumCulled=false;bankDots.visible=false;bankDots.renderOrder=AIM.renderOrder;scene.add(bankDots);
  const ring=new THREE.Mesh(new THREE.RingGeometry(AIM.reticleSize*.7,AIM.reticleSize,24),new THREE.MeshBasicMaterial({color:'#ffe6a0',side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:false}));
  ring.visible=false;ring.renderOrder=AIM.renderOrder;scene.add(ring);
  function velocity() {return (!state.traversal || state.traversal.ready) && state.aim && directVelocity({origin:lead.pos,...state.aim,speed,cool:state.cool,grounded:lead.grounded});}
  const ordinaryColor=ring.material.color.clone();
  function cancel() {state.aim=null;dots.visible=ring.visible=bankDots.visible=false;}
  function plot(points,from,to) {
    const positions=points.geometry.attributes.position;
    for(let index=0;index<AIM.dots;index++) {
      const share=(index+1)/AIM.dots;
      positions.setXYZ(index,from.x+(to.x-from.x)*share,from.y+(to.y-from.y)*share,from.z+(to.z-from.z)*share);
    }
    positions.needsUpdate=true;
  }
  function bankPreview(shot) {
    if(lead.grounded||!state.aim?.target.bankId)return null;
    const canopy=canopies.find(item=>item.id===state.aim.target.bankId);
    if(!canopy)return null;
    const blockers=[...lockable().filter(item=>item.alive),...canopies.filter(item=>item!==canopy)];
    return previewBank({origin:lead.pos,velocity:carryLaunch(lead.vel,shot),canopy,radius,heightAt:floorAt,props,blockers});
  }
  function refresh() {
    const v=velocity();dots.visible=ring.visible=!!v;bankDots.visible=false;if(!v)return;
    const bank=bankPreview(v);
    const length=Math.hypot(v.x,v.y,v.z),distance=lead.pos.distanceTo(new THREE.Vector3().copy(state.aim.target));
    // Put the marker on the near face of a selected collider, not inside it.
    const cueDistance=Math.max(0,distance-(state.aim.target.radius || 0));
    const endpoint=new THREE.Vector3().copy(lead.pos).addScaledVector(v,cueDistance/length);
    plot(dots,lead.pos,bank?bank.contact:endpoint);
    ring.material.color.copy(bank?bankDots.material.color:ordinaryColor);
    ring.position.copy(bank?bank.marker:endpoint);ring.quaternion.copy(camera.quaternion);
    if(bank){bankDots.visible=true;plot(bankDots,bank.contact,bank.exit);}
  }
  return {velocity,cancel,refresh,bankPreview,
    move(x,y,w,h,power,pixels,monster) {
      camera.updateMatrixWorld();ray.setFromCamera({x:x/w*2-1,y:1-y/h*2},camera);
      const bank=lead.grounded?undefined:{canopies,origin:lead.pos,velocity:lead.vel,speed};
      const target=pickTarget(ray.ray.origin,ray.ray.direction,(Array.isArray(monster)?monster:{...monster,radius:monster.radius??MONSTER.radius}),floorAt,radius,props,bank);
      state.aim={target,power,pixels};refresh();
    },
  };
}
