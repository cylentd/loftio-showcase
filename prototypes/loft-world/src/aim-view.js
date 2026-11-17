import * as THREE from 'three';
import { AIM } from './control-constants.mjs';
import { directVelocity, pickTarget } from './aim-model.mjs';
import { MONSTER } from './monster.js';

export function createAim({scene,camera,lead,state,floorAt,radius,speed,glow,props=[]}) {
  const ray=new THREE.Raycaster();
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(AIM.dots*3),3));
  const material=new THREE.PointsMaterial({map:glow,size:AIM.dotSize,transparent:true,depthWrite:false,color:'#ffe6a0'});
  const dots=new THREE.Points(geometry,material);dots.frustumCulled=false;dots.visible=false;scene.add(dots);
  const ring=new THREE.Mesh(new THREE.RingGeometry(AIM.reticleSize*.7,AIM.reticleSize,24),new THREE.MeshBasicMaterial({color:'#ffe6a0',side:THREE.DoubleSide,transparent:true,depthWrite:false}));
  ring.visible=false;scene.add(ring);
  function velocity() {return (!state.traversal || state.traversal.ready) && state.aim && directVelocity({origin:lead.pos,...state.aim,speed,cool:state.cool,grounded:lead.grounded});}
  function cancel() {state.aim=null;dots.visible=ring.visible=false;}
  function refresh() {
    const v=velocity();dots.visible=ring.visible=!!v;if(!v)return;
    const length=Math.hypot(v.x,v.y,v.z),distance=lead.pos.distanceTo(new THREE.Vector3().copy(state.aim.target));
    // Put the marker on the near face of a selected collider, not inside it.
    const cueDistance=Math.max(0,distance-(state.aim.target.radius || 0));
    const endpoint=new THREE.Vector3().copy(lead.pos).addScaledVector(v,cueDistance/length);
    const positions=geometry.attributes.position;
    for(let i=0;i<AIM.dots;i++) {const t=(i+1)/AIM.dots;positions.setXYZ(i,lead.pos.x+(endpoint.x-lead.pos.x)*t,lead.pos.y+(endpoint.y-lead.pos.y)*t,lead.pos.z+(endpoint.z-lead.pos.z)*t);}
    positions.needsUpdate=true;ring.position.copy(endpoint);ring.quaternion.copy(camera.quaternion);
  }
  return {velocity,cancel,refresh,
    move(x,y,w,h,power,pixels,monster) {
      camera.updateMatrixWorld();ray.setFromCamera({x:x/w*2-1,y:1-y/h*2},camera);
      const target=pickTarget(ray.ray.origin,ray.ray.direction,(Array.isArray(monster)?monster:{...monster,radius:monster.radius??MONSTER.radius}),floorAt,radius,props);
      state.aim={target,power,pixels};refresh();
    },
  };
}
