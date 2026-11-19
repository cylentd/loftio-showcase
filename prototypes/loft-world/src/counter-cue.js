// Counter cue: gold sparks over a monster's head while pressing F would counter it (a wind-up or follow-through).
import * as THREE from 'three';
import {counterOpen} from './creature-model.mjs';
import {COUNTER_CUE as CUE} from './teamwork-constants.mjs';

/** Three jagged strokes fanning upward, drawn once on a canvas: the "something is coming" spark. */
export function sparkTexture() {
  const size=CUE.canvas,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const g=canvas.getContext('2d'),mid=size/2;
  g.strokeStyle='#ffffff';g.lineWidth=CUE.stroke;g.lineCap=g.lineJoin='round';
  g.shadowColor='#ffffff';g.shadowBlur=CUE.stroke;
  for(let k=0;k<CUE.strokes;k++){
    const a=(k-(CUE.strokes-1)/2)*CUE.fan,dx=Math.sin(a),dy=-Math.cos(a),px=-dy,py=dx;
    const at=([t,side])=>[mid+dx*size*t+px*size*side,size*CUE.base+dy*size*t+py*size*side];
    g.beginPath();g.moveTo(...at(CUE.zig[0]));for(const point of CUE.zig.slice(1))g.lineTo(...at(point));g.stroke();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export function createCounterCue({scene,texture,monster,reducedMotion=()=>false}) {
  const sprites=new Map();
  const spriteFor=enemy=>{
    let sprite=sprites.get(enemy.id);
    if(!sprite){
      sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:CUE.color,transparent:true,depthWrite:false,opacity:CUE.opacity}));
      sprite.visible=false;scene.add(sprite);sprites.set(enemy.id,sprite);
    }
    return sprite;
  };
  return {
    update(time){
      for(const enemy of monster.states??[]){
        const sprite=spriteFor(enemy),on=!!enemy.alive&&counterOpen(enemy);
        sprite.visible=on;
        if(!on)continue;
        const pulse=reducedMotion()?1:1+Math.sin(time*CUE.pulseRate)*CUE.pulse;
        sprite.position.set(enemy.pos.x,enemy.pos.y+enemy.radius*CUE.above,enemy.pos.z);
        sprite.scale.setScalar(enemy.radius*CUE.size*pulse);
      }
    },
    reset(){for(const sprite of sprites.values())sprite.visible=false;},
  };
}
