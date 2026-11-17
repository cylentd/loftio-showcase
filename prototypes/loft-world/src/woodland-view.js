import * as THREE from 'three';
import {softMaterial} from './glsl.js';
import {V3,tint,place,merge,tube,rng} from './util.js';
import {HABITATS,LOOK,MEADOW_LOOK} from './terrain-look-data.mjs';
import {feedbackPose} from './terrain-props.mjs';

// A folded pointed leaf, merged into whole fronds/branches before being submitted.
export function leafGeometry(length=1,width=.3){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-width,length*.45,0,0,length*.52,.12*length,width,length*.45,0,0,length,0],3));
  g.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);g.computeVertexNormals();return g;
}
export function propGeometry(p){
  const positions=[];
  for(const f of p.faces)for(let i=1;i<f.length-1;i++)for(const index of [f[0],f[i],f[i+1]]){
    const v=p.vertices[index];positions.push(v.x-p.center.x,v.y-p.y,v.z-p.center.z);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  return tint(g,p.color,0,(c,x,y,z)=>{
    const grain=.78+.22*Math.sin(x*17+z*23+y*7);c.multiplyScalar(grain);
    if(p.material==='rock'&&y>p.height*.8)c.lerp(new THREE.Color('#667b42'),.45);
  });
}
export function buildWoodland(scene,terrain,props){
  const H=terrain.heightAt,R=rng(LOOK.seed),views=new Map(),parts={fern:[],reed:[],litter:[]};
  for(const p of props){
    const group=new THREE.Group();group.position.set(p.x,p.y,p.z);
    const mesh=new THREE.Mesh(propGeometry(p),softMaterial({fuzz:.12,gloss:p.material==='spring'?.18:0}));group.add(mesh);
    if(p.material==='spring'){
      const stem=tube([V3(.3,0,0),V3(-.15,1,0),V3(0,2.3,0)],[.65,.5,.7],12);
      group.add(new THREE.Mesh(tint(stem,'#c7b184'),softMaterial({fuzz:.1})));
      const ribs=[];
      for(let i=0;i<24;i++){
        const a=i/24*Math.PI*2;
        ribs.push(tint(tube([V3(Math.cos(a)*.6,2.1,Math.sin(a)*.6),V3(Math.cos(a)*2.8,2.03,Math.sin(a)*2.8)],[.025,.04],4),'#e0bb83'));
      }
      group.add(new THREE.Mesh(merge(ribs),softMaterial()));
    }
    if(p.material==='rock'){
      const moss=[];
      for(let i=0;i<55;i++){
        const a=R()*Math.PI*2,r=Math.sqrt(R())*p.r*p.topScale*.85;
        moss.push(place(tint(leafGeometry(.18+R()*.25,.12),i%3?'#637343':'#a2a67b'),Math.cos(a)*r,p.height+.02,Math.sin(a)*r,Math.PI/2,a,0));
      }
      group.add(new THREE.Mesh(merge(moss),softMaterial({fuzz:.3})));
    }
    if(p.material==='foliage'){
      const leaves=[];
      for(let i=0;i<110;i++){
        const a=R()*Math.PI*2,r=Math.sqrt(R())*p.r;
        leaves.push(place(tint(leafGeometry(.7+R(),.3),'#5a804c'),Math.cos(a)*r,.4+R(),Math.sin(a)*r,R(),a,.5));
      }
      group.add(new THREE.Mesh(merge(leaves),softMaterial({sway:.3,leaf:1})));
    }
    scene.add(group);views.set(p.id,{group,event:null,age:0});
  }
  // Habitat-specific clusters leave the path and route landings open.
  for(const h of HABITATS)for(let i=0;i<MEADOW_LOOK.habitatCount;i++){
    const a=R()*Math.PI*2,r=Math.sqrt(R())*h.r,x=h.x+Math.cos(a)*r,z=h.z+Math.sin(a)*r;
    if(terrain.maskAt(x,z).path>.15)continue;
    const y=H(x,z),angle=R()*Math.PI*2;
    if(h.kind==='fern'){
      for(let j=0;j<6;j++){
        const f=j/6,l=.85-f*.65;
        for(const side of [-1,1])parts.fern.push(place(tint(leafGeometry(l,.18),'#507a4b'),x+Math.sin(angle)*f,y+.1+f*.8,z+Math.cos(angle)*f,.7,angle,side*.9));
      }
      if(i%9===0)parts.fern.push(place(tint(leafGeometry(.25,.18),'#d6c58d'),x,y+1.1,z,1,angle,0));
    }else if(h.kind==='reed'){
      parts.reed.push(place(tint(leafGeometry(1.6+R(),.075),'#7f9055'),x,y,z,.2,angle,.15));
      if(i%3===0)parts.reed.push(place(tint(new THREE.CapsuleGeometry(.07,.4,2,5),'#68513a'),x,y+1.8,z));
    }else parts.litter.push(place(tint(leafGeometry(.3+R()*.5,.16),i%2?'#8a7547':'#53613d'),x,y+.05,z,Math.PI/2,angle,0));
  }
  for(const [kind,list] of Object.entries(parts))if(list.length)scene.add(new THREE.Mesh(merge(list),softMaterial({sway:kind==='litter'?0:.35,fuzz:.15})));
  return {views,impact(e){const v=views.get(e.contactId);if(v){v.event=e;v.age=0;}},update(dt,reduced){
    for(const v of views.values()){
      v.age+=dt;const pose=feedbackPose(v.event,v.age,reduced);v.group.scale.y=pose.scaleY;
      // Static low-contrast response in reduced mode; no bright additive flash.
      v.group.children[0].material.uniforms.uImpactTint.value=pose.tint;
    }
  }};
}
