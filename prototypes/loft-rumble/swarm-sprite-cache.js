// Swarm sprite cache, the pure half: which sprite a monster needs, and which sprite leaves when the cache is full. A monster kind
// in a pose is painted once to an offscreen canvas (swarm-sprites.js) and drawn with drawImage, so the frame holds no gradient.
// A pose value is rounded to its step (swarm-data.js SPRITE), so a continuous breathe, flap or zoom lands on a few reused keys.
// No canvas, no clock here: variant() and key() name a sprite, extent() is its rectangle in art units, lru() is its store.
(function(root){
  'use strict';
  const D=root.LoftRumbleSwarmData,S=D.SPRITE;
  const LOG_STEP=Math.log(1+S.SIZE_STEP);
  const WINGED='centre'; // the anchor of the one kind that flaps (ART.bounds); the walkers anchor on their feet
  const clamp01=v=>Math.max(0,Math.min(1,v));

  // Device pixels per art unit, rounded UP to the next size step: a bucket index, and the size of its bucket.
  const sizeBucket=px=>Math.ceil(Math.log(px)/LOG_STEP);
  const sizeOf=bucket=>Math.pow(1+S.SIZE_STEP,bucket);

  // The pose of one frame (swarm-monster-art.js pose()) as whole step counts. A walker has no wing.
  function variant(kind,pose,px){
    const winged=D.ART.bounds[kind].anchor===WINGED;
    return{kind,sx:Math.round(pose.scaleX/S.SQUASH_STEP),sy:Math.round(pose.scaleY/S.SQUASH_STEP),
      wing:winged?Math.round(pose.wing/S.WING_STEP):0,flash:Math.round(clamp01(pose.flash)*S.FLASH_STEPS),size:sizeBucket(px)};
  }
  // The values a sprite is painted at: the step counts back as numbers.
  const levels=v=>({sx:v.sx*S.SQUASH_STEP,sy:v.sy*S.SQUASH_STEP,wing:v.wing*S.WING_STEP,flash:v.flash/S.FLASH_STEPS,px:sizeOf(v.size)});
  // A device coordinate as a whole pixel and a count of quarter pixels past it (0..PHASES-1). The sprite is painted `q` quarters
  // in and blitted on `whole`, which is a plain pixel copy, so it matches the live drawing at that sub-pixel offset to a quarter.
  function phase(coord){
    const t=Math.round(coord*S.PHASES),whole=Math.floor(t/S.PHASES);
    return{whole,q:t-whole*S.PHASES};
  }
  const key=(v,ph)=>[v.kind,v.sx,v.sy,v.wing,v.flash,v.size,ph?ph.x:0,ph?ph.y:0].join('|');

  // The sprite's rectangle in art units about the anchor (feet on the origin for walkers, the body's centre for the flyer): the
  // art's bounds and PAD round them. The shadow is not in it (it is drawn live) and neither is the flyer's bob (a shift at draw).
  function extent(kind){
    const b=D.ART.bounds[kind],pad=S.PAD,w=b.w+2*pad,h=b.h+2*pad;
    return{x0:-w/2,y0:b.anchor===WINGED?-h/2:-(b.h+pad),w,h};
  }

  // A hit sprite (lag fix 2026-11-20): a flashed pose painted at rest scale and no quarter phase. The squash and breathe are a
  // scale at blit time, so a hit needs kind x wing x flash x size sprites (about 60 per size), not one per squash and phase
  // (about 3,200), and they can all be painted before the first hit (warmList). Null when the pose shows no flash.
  const REST=Math.round(1/S.SQUASH_STEP);
  function hitVariant(kind,pose,px){
    const v=variant(kind,pose,px);
    return v.flash?{...v,sx:REST,sy:REST}:null;
  }
  const hitKey=v=>'hit|'+[v.kind,v.wing,v.flash,v.size].join('|');
  // Every hit sprite one kind can need at one size: each flash level, and for the flier each wing level its flap reaches.
  function warmList(kind,px){
    const winged=D.ART.bounds[kind].anchor===WINGED,most=winged?Math.round(D.ART.flapAmp/S.WING_STEP):0,size=sizeBucket(px),out=[];
    for(let flash=1;flash<=S.FLASH_STEPS;flash++)for(let wing=-most;wing<=most;wing++)out.push({kind,sx:REST,sy:REST,wing,flash,size});
    return out;
  }

  // Every resting sprite (no flash) one kind draws at one size, as [variant, phase] pairs: each rounded breathe or flap pose
  // over one full motion cycle, the reduced-motion rest pose, and each quarter phase. poseAt(t) is the art's pose at clock t
  // (swarm-monster-art.js pose); a monster's own phase only shifts t, so one cycle covers every monster.
  const REST_SAMPLES=720; // samples per motion cycle: a 1.1 Hz breathe moves under .0005 of its swing between two, far below a step
  function restList(kind,px,poseAt){
    const A=D.ART,cycle=1/Math.min(A.breatheHz,A.bobHz,A.flapHz),seen=new Map();
    const add=pose=>{const v=variant(kind,{...pose,flash:0},px);seen.set(key(v),v)};
    add({scaleX:1,scaleY:1,wing:0});
    for(let i=0;i<REST_SAMPLES;i++)add(poseAt(cycle*i/REST_SAMPLES));
    const out=[];
    for(const v of seen.values())for(let x=0;x<S.PHASES;x++)for(let y=0;y<S.PHASES;y++)out.push([v,{x,y}]);
    return out;
  }

  // A health bar: its fill share in twentieths, and the size bucket.
  const barVariant=(share,px)=>({fill:Math.round(clamp01(share)*S.BAR_STEPS),size:sizeBucket(px)});
  const barKey=v=>'bar|'+v.fill+'|'+v.size;

  // A least-recently-used store of at most `cap` entries. set() returns the [key, value] pairs it dropped, so the caller can
  // release what they hold. Map keeps insertion order, so the first key is the oldest use.
  function lru(cap){
    const map=new Map();
    return{
      get(k){
        if(!map.has(k))return undefined;
        const v=map.get(k);map.delete(k);map.set(k,v);
        return v;
      },
      set(k,v){
        map.delete(k);map.set(k,v);
        const dropped=[];
        while(map.size>cap){const [old]=map.keys();dropped.push([old,map.get(old)]);map.delete(old);}
        return dropped;
      },
      size:()=>map.size,
    };
  }

  const api=Object.freeze({sizeBucket,sizeOf,variant,levels,phase,key,extent,hitVariant,hitKey,warmList,restList,barVariant,barKey,lru});
  root.LoftRumbleSwarmSpriteCache=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
