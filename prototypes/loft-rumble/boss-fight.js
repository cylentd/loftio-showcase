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

  // A band across the beam (y from -half to half) along x from..to, fading to clear at its edges: the glow and the core.
  function band(ctx,from,to,half,colour,alpha,solid){
    const g=ctx.createLinearGradient(0,-half,0,half);
    g.addColorStop(0,'transparent');g.addColorStop(HALF-solid*HALF,colour);g.addColorStop(HALF+solid*HALF,colour);g.addColorStop(1,'transparent');
    ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=g;ctx.fillRect(Math.min(from,to),-half,Math.abs(to-from),2*half);ctx.restore();
  }
  // A bright run along the core, clear at both ends.
  function run(ctx,r,half,colour){
    const g=ctx.createLinearGradient(r.from,0,r.to,0);g.addColorStop(0,'transparent');g.addColorStop(HALF,colour);g.addColorStop(1,'transparent');
    ctx.save();ctx.globalAlpha*=r.alpha;ctx.fillStyle=g;ctx.fillRect(Math.min(r.from,r.to),-half,Math.abs(r.to-r.from),2*half);ctx.restore();
  }
  function particle(ctx,image,p,crops,glow){
    const [sx,sy,sw,sh]=crops[p.kind][p.crop],scale=p.size/Math.max(sw,sh);
    ctx.save();ctx.globalAlpha*=p.alpha;ctx.translate(p.x,p.y);ctx.rotate(p.spin);
    if(glow){ctx.shadowColor=glow;ctx.shadowBlur=F().beam.particles.size.spark*HALF;}
    ctx.drawImage(image,sx,sy,sw,sh,-sw*scale*HALF,-sh*scale*HALF,sw*scale,sh*scale);ctx.restore();
  }
  // The spiral glow where a beam meets the wall, upright like the source glows.
  function endGlow(ctx,image,e,angle,upright){
    const G=F().sources,width=e.size,height=width*image.height/image.width;
    ctx.save();ctx.globalAlpha*=e.alpha;ctx.translate(e.x,0);ctx.rotate(-angle);ctx.scale(1,upright);
    ctx.drawImage(image,-G.coreX*width,-G.coreY*height,width,height);ctx.restore();
  }
  // The fired beam in the beam's own frame (the page has translated to the boss and rotated to the lane).
  // o: {fx, feel, radius, length, reduced, image(name), lane(reach, half, alpha, edge), tint, ends, angle, upright}.
  // lane is the page's own drawing of the hit lane (its colour token): a faint fill at alpha and an outline at exactly
  // half, edge {alpha, width}, drawn first so the danger edge stays exact under the beam. tint: the page's colour tokens
  // {fire, core} for the amber glow, warm core and running bands; without them only the strips draw (the page owns the
  // colours). ends: wallReach's {fore, back}, for the spiral glows at the walls. Particles draw when their texture is loaded.
  function beam(ctx,o){
    const d=F(),strip=o.image(d.textures.beam);if(!strip)return false;
    const out=M().beamSegments(o.fx,o.feel,o.radius,o.length,d,o.reduced);if(!out)return false;
    const look=M().beamLook(o.fx,o.feel,o.radius,o.length,d,o.reduced),reach=out.lane.reach;
    if(o.lane){ctx.save();o.lane(reach,out.lane.half,out.lane.alpha,{alpha:d.beam.laneEdge.alpha*out.alpha,width:d.beam.laneEdge.width});ctx.restore();}
    if(o.tint){band(ctx,-reach,reach,look.glowHalf,o.tint.fire,look.glowAlpha,d.beam.glow.solid);band(ctx,-reach,reach,look.coreHalf,o.tint.core,look.coreAlpha,d.beam.core.solid);}
    ctx.save();ctx.globalAlpha*=out.alpha;
    for(const {image:span} of out.segments){const dir=Math.sign(span.to-span.from); // mirrored for the backward beam
      ctx.save();ctx.scale(dir,1);ctx.drawImage(strip,span.from*dir,-out.width*HALF,(span.to-span.from)*dir,out.width);ctx.restore();}
    ctx.restore();
    if(o.tint)for(const r of look.runs)run(ctx,r,look.coreHalf,o.tint.core);
    const sheet=o.image(d.beam.particles.texture);
    if(sheet)for(const p of M().beamParticles(o.fx,o.feel,o.radius,o.length,d,o.reduced))particle(ctx,sheet,p,d.beam.particles.crops,o.tint?.fire);
    const source=o.ends&&o.image(d.textures.source);
    if(source)for(const e of M().beamEnds(reach,o.ends,look.k,o.radius,d))endGlow(ctx,source,e,o.angle??0,o.upright??1);
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

  // The Slam landing (LM3b), one depth layer: 'ground' (the crack, under the shockwave and the boss), 'behind' (debris
  // up-screen of the foot, before the boss) or 'front' (debris down-screen, after it). True when the layer is this
  // renderer's, so the page skips its old crack sprite; false off the storybook pack or without the crack art.
  // o: {layer, fx, feel, enemy, radius, upright, reduced, arena, enabled, image(name)}
  function slam(ctx,o){
    const S=F().slam,crackImage=o.enabled&&o.image(S.crack.texture);if(!crackImage)return false;
    const m=M(),foot=F().storybook.bossFoot*o.radius*o.upright;
    if(o.layer==='ground'){
      const box=m.slamCrack({...o,texture:crackImage},F(),R());if(!box)return true;
      ctx.save();ctx.globalAlpha*=box.alpha;ctx.translate(o.enemy.x+box.gx,o.enemy.y+box.gy);ctx.scale(1,o.upright);
      ctx.drawImage(crackImage,box.left,box.top,box.width,box.height);ctx.restore();
      return true;
    }
    const behind=o.layer==='behind';
    for(const p of m.slamDebris(o,F(),R())){
      if((p.y<0)!==behind)continue;  // 3/4 view: a piece up-screen of the foot is behind the boss
      const image=o.image(S.debris[p.kind]);if(!image)continue;
      const w=p.size,h=w*image.height/image.width;
      ctx.save();ctx.globalAlpha*=p.alpha;ctx.translate(o.enemy.x,o.enemy.y+foot);ctx.scale(1,o.upright);
      ctx.translate(p.x,p.y-p.h);ctx.rotate(p.rot);ctx.drawImage(image,-w*HALF,-h*HALF,w,h);ctx.restore();
    }
    return true;
  }
  // Whether shadow() will draw: the camera asks before its flat contact oval. Takes (ctx, o) like every export here,
  // and never draws. o: {enabled, image(name)}
  function ownsShadow(ctx,o){const S=F().slam.shadow;return !!(S.on&&o.enabled&&o.image(S.texture));}
  // The rig's ground shadow at the foot anchor, under the boss and its rear shield. It reads the hop from the attack
  // clock, so the boss's own hop offset never moves it. True when drawn (the camera then skips its flat contact oval).
  // o: {fx, feel, timing, clock, enemy, radius, upright, reduced, enabled, image(name)}
  function shadow(ctx,o){
    const S=F().slam.shadow,image=ownsShadow(ctx,o)&&o.image(S.texture);if(!image)return false;
    const out=M().groundShadow(o,F(),R()),part=R().parts.shadow;
    ctx.save();ctx.globalAlpha*=out.alpha;ctx.translate(o.enemy.x,o.enemy.y);ctx.transform(...out.matrix);
    ctx.drawImage(image,part.x,part.y,part.w,part.h);ctx.restore();
    return true;
  }

  root.LoftRumbleBossFight=Object.freeze({body,shield,beam,sources,slam,shadow,ownsShadow});
})(globalThis);
