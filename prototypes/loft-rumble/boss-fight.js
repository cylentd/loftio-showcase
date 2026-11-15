(function(root){
  'use strict';
  // Bramble in the live fight (LM3): the living-magic rig, the rotating shield with front, side and rear views, crack and
  // break, and the two-way beam with its two source glows. Pure look: it reads the fight's state and never changes it.
  // Each function returns false when its textures are not loaded, so the page keeps its old drawing for that frame.
  // Geometry and state: boss-fight-model.js; numbers: boss-fight-data.js.
  const F=()=>root.LoftRumbleBossFightData,M=()=>root.LoftRumbleBossFightModel,R=()=>root.LoftRumbleBossRigData,Rig=()=>root.LoftRumbleBossRig;
  const HALF=.5,TURN=Math.PI*2;
  const looks=new WeakMap();  // the shield's look state per fight shield object: {state, clock}

  function textures(image,names){const out=names.map(image);return out.every(Boolean)?out:null;}

  // The rig, drawn in the boss's local frame (the page has already moved it for hop, lunge, hit squash and finale).
  // o: {fx, feel, timing, clock, radius, upright, reduced, fade, enabled, image(name)}
  function body(ctx,o){
    const d=F(),r=R();if(!o.enabled)return false;
    const images=textures(o.image,d.rigLayers.map(id=>d.rigTextures[id]));if(!images)return false;
    const p=M().pose(o,o.reduced,d,r),rig=Rig().rig(p,r),base=M().rigBase(o.radius,o.upright,d,r);
    ctx.save();ctx.globalAlpha*=o.fade;
    d.rigLayers.forEach((id,i)=>{const part=r.parts[id];ctx.save();ctx.transform(...base);ctx.transform(...rig.matrices[id]);
      ctx.drawImage(images[i],part.x,part.y,part.w,part.h);ctx.restore();});
    ctx.restore();
    return true;
  }

  function advance(shield,clock){
    const was=looks.get(shield)??{state:M().shieldInitial(),clock};
    const now={state:M().shieldNext(was.state,{shield,dt:clock-was.clock}),clock};
    looks.set(shield,now);return now.state;
  }
  function sprite(ctx,image,x,y,box,upright,alpha){
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.scale(1,upright);
    if(box.mirror){ctx.scale(-1,1);ctx.drawImage(image,-box.left-box.width,box.top,box.width,box.height)}
    else ctx.drawImage(image,box.left,box.top,box.width,box.height);
    ctx.restore();
  }
  // The break, front layer: the white core and amber ring at the plate's middle height, then the shards with a rim glow.
  // tint: the page's colour tokens {ring, edge, flash, rim}; without them only the shards draw (the page owns the colours).
  function shatter(ctx,o,sh,d,m){
    const T=d.textures,front=m.shieldBox('front',sh.angle,o.plate,o.arc,o.upright,o.image(T.front),d);
    const flash=o.tint&&m.breakFlash(sh,o.feel,o.plate,o.reduced,d),bits=m.shards(sh,o.feel,o.plate,o.reduced,d);
    if(flash){const lift=front.height*d.shield.front.wall*HALF;
      ctx.save();ctx.translate(o.enemy.x+flash.gx,o.enemy.y+flash.gy);ctx.scale(1,o.upright);
      if(flash.core>0){ctx.globalAlpha=flash.core;ctx.fillStyle=o.tint.flash;ctx.beginPath();ctx.arc(0,-lift,flash.radius,0,TURN);ctx.fill();}
      const ring=(colour,alpha,width)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.beginPath();ctx.arc(0,-lift,flash.radius,0,TURN);ctx.stroke();};
      ring(o.tint.edge,flash.alpha*d.shield.flash.edgeAlpha,flash.width+d.shield.flash.edge);ring(o.tint.ring,flash.alpha,flash.width);
      ctx.restore();}
    if(!bits)return;
    const image=o.image(T.shards),width=front.width*(bits.scale+bits.grow),height=width*image.height/image.width;
    ctx.save();if(o.tint){ctx.shadowColor=o.tint.rim;ctx.shadowBlur=d.shield.shards.rimBlur;}
    sprite(ctx,image,o.enemy.x+bits.gx,o.enemy.y+bits.gy,{left:-width*HALF,top:-height*(1-bits.drop),width,height,mirror:false},o.upright,bits.alpha);
    ctx.restore();
  }
  // One depth layer of the shield: 'rear' before the boss is drawn, 'front' after it. Also the break (front).
  // The turning plate is one opaque sprite (shieldLook); only the page's re-form fade-in (`up`) changes its alpha.
  // o: {layer, shield, enemy, plate, arc, feel, clock, upright, reduced, alive, tint, image(name)}
  function shield(ctx,o){
    const d=F(),m=M(),T=d.textures;
    if(!textures(o.image,[T.front,T.cracked,T.side,T.rear,T.shards]))return false;
    const sh=o.shield,state=advance(sh,o.clock);
    if(!o.alive)return true;
    if(sh.down>0){if(o.layer==='front')shatter(ctx,o,sh,d,m);return true;}
    const v=m.shieldLook(sh.angle,d);if(v.depth!==o.layer)return true;
    const image=o.image(m.shieldTexture(v.view,state.phase,d)),box=m.squashBox(m.shieldBox(v.view,sh.angle,o.plate,o.arc,o.upright,image,d),v.squash);
    sprite(ctx,image,o.enemy.x+box.gx+m.crackShake(state,o.reduced,d),o.enemy.y+box.gy,box,o.upright,sh.up);
    return true;
  }

  // The fired beam in the beam's own frame (the page has translated to the boss and rotated to the lane).
  // o: {fx, feel, radius, length, reduced, image(name), lane(reach, half, alpha)}. lane is the page's own fill of the hit
  // lane (its colour token), drawn first so the danger edge stays exact under the strips.
  function beam(ctx,o){
    const strip=o.image(F().textures.beam);if(!strip)return false;
    const out=M().beamSegments(o.fx,o.feel,o.radius,o.length,F(),o.reduced);if(!out)return false;
    if(o.lane){ctx.save();o.lane(out.lane.reach,out.lane.half,out.lane.alpha);ctx.restore();}
    ctx.save();ctx.globalAlpha*=out.alpha;
    for(const {image:span} of out.segments){const dir=Math.sign(span.to-span.from); // mirrored for the backward beam
      ctx.save();ctx.scale(dir,1);ctx.drawImage(strip,span.from*dir,-out.width*HALF,(span.to-span.from)*dir,out.width);ctx.restore();}
    ctx.restore();
    return true;
  }

  // The two source glows, upright, in the boss's local frame. o: {cue, fx, feel, radius, upright, image(name)}
  function sources(ctx,o){
    const G=F().sources,image=o.image(F().textures.source);if(!image)return false;
    const out=M().beamSources(o,F());if(!out)return true;
    const width=out.size,height=width*image.height/image.width;
    for(const p of out.points){ctx.save();ctx.globalAlpha*=out.alpha;ctx.translate(p.x,p.y);ctx.scale(1,o.upright);
      ctx.drawImage(image,-G.coreX*width,-G.coreY*height,width,height);ctx.restore();}
    return true;
  }

  root.LoftRumbleBossFight=Object.freeze({body,shield,beam,sources});
})(globalThis);
