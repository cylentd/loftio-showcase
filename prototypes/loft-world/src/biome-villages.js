import * as THREE from 'three';
import {softMaterial} from './glsl.js';
import {merge,place,tint} from './util.js';

const VILLAGES=[
  {name:'Lantern grove',wall:'#ac8867',roof:'#426d5d',glow:'#ffcf8c',tall:1,homes:[[10,-3,.8],[-5,8,.65]]},
  {name:'Moonwater',wall:'#9baeb3',roof:'#466b89',glow:'#b9e9de',tall:.75,homes:[[72,73,.85],[84,69,.7],[94,65,.6]]},
  {name:'Aurora camp',wall:'#b59b8d',roof:'#6a587d',glow:'#ffd8ac',tall:1.3,homes:[[-69,-36,.8],[-85,-37,.65],[-91,-22,.7]]},
];
const HOUSE={radius:2.8,height:3.4,roofRadius:3.3,segments:24,rings:16,window:.42,door:.72};
function cottage(palette) {
  const parts=[], sphere=()=>new THREE.SphereGeometry(1,HOUSE.segments,HOUSE.rings);
  parts.push(place(tint(new THREE.CylinderGeometry(HOUSE.radius*.93,HOUSE.radius,HOUSE.height,HOUSE.segments),palette.wall),0,HOUSE.height/2,0));
  parts.push(place(tint(sphere(),palette.roof),0,HOUSE.height,0,0,0,0,HOUSE.roofRadius,palette.tall*1.7,HOUSE.roofRadius));
  parts.push(place(tint(new THREE.CapsuleGeometry(HOUSE.door,1.2,6,16),'#493a48'),0,1.35,HOUSE.radius-.12,0,0,0,1,1,.2));
  for(const side of [-1,1]){
    parts.push(place(tint(sphere(),palette.glow,.7),side*1.65,2.2,2.25,0,0,0,HOUSE.window,HOUSE.window,.12));
    parts.push(place(tint(new THREE.TorusGeometry(HOUSE.window,.07,6,20),'#d6b89b'),side*1.65,2.2,2.27));
  }
  parts.push(place(tint(new THREE.CylinderGeometry(3,3.2,.3,24),'#77767b'),0,.05,0));
  return new THREE.Mesh(merge(parts),softMaterial({fuzz:.25}));
}
export function buildVillages(scene,terrain,solids) {
  for(const village of VILLAGES){
    for(const [x,z,scale] of village.homes){
      const home=cottage(village),ground=terrain.heightAt(x,z);
      home.position.set(x,ground,z);home.scale.setScalar(scale);
      home.rotation.y=Math.atan2(-x,-z);
      home.userData.biome=village.name;
      scene.add(home);solids.push([x,z,HOUSE.radius*scale,ground+HOUSE.height*scale]);
    }
  }
}
