(function(root){
  'use strict';
  const K=root.LoftRumbleFinishConstants,M=root.LoftRumbleFinishModel;
  const circle=(ctx,x,y,r)=>{ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.fill();};
  function residents(ctx,b,p,images,time){
    const im=images[b.id];if(!im?.complete||!im.naturalWidth)return;
    ctx.save();ctx.translate(b.x+b.pose.x,b.y+b.pose.y);ctx.scale(1,p.projection.upright);
    if(b.squash){const k=p.feel.wallSquash*b.squash.life/p.feel.wallSquashLife*(1-M.travel(time)/M.travel(K.holdMs));
      const angle=Math.atan2(b.squash.ny,b.squash.nx);ctx.rotate(angle);ctx.scale(1-k,1+k*K.half);ctx.rotate(-angle);}
    ctx.rotate(b.angle+b.pose.rotation);ctx.scale((1+b.pulse)*b.pose.sx,(1-b.pulse*K.half)*b.pose.sy);
    if(root.LoftRumbleBattleMaterials)root.LoftRumbleBattleMaterials.resident(ctx,im,b.size,p.skin);
    else ctx.drawImage(im,-b.size/2,-b.size/2,b.size,b.size);
    ctx.restore();
  }
  function boss(ctx,b,p,time,artwork){
    const image=name=>artwork?.available(name),feel=p.feel;
    const progress=M.travel(time)/M.travel(K.holdMs),reaction=p.boss.reaction;
    const ox=(reaction?.nx??0)*K.recoil*progress,oy=(reaction?.ny??0)*K.recoil*progress;
    const fx=p.boss.fx?{...p.boss.fx,t:p.boss.fx.t+M.travel(time)}:null;
    ctx.save();ctx.translate(b.x+ox,b.y+oy);
    if(reaction){const k=feel.enemySquash*reaction.k*reaction.life/feel.enemySquashLife*(1-progress),angle=Math.atan2(reaction.ny,reaction.nx);
      ctx.rotate(angle);ctx.scale(1-k,1+k*K.half);ctx.rotate(-angle);}
    const rig=root.LoftRumbleBossFight?.body(ctx,{fx,feel,timing:p.timing,clock:p.boss.clock+M.travel(time),
      radius:b.radius,upright:p.projection.upright,reduced:false,fade:1,enabled:p.storybook,image});
    if(!rig){const im=image('boss-body');if(im){const size=b.radius*(artwork.metrics.bossSize??2);
      ctx.scale(1,p.projection.upright);ctx.drawImage(im,-size/2,-size/2,size,size);}}
    ctx.restore();
  }
  // Use the pure shield geometry, never the live renderer's WeakMap lifecycle cache.
  function shield(ctx,b,p,artwork,layer){
    const sh=p.boss.shield;if(!sh||sh.down>0)return;
    const model=root.LoftRumbleBossFightModel,data=root.LoftRumbleBossFightData;
    const look=model.shieldLook(sh.angle,data);if(look.depth!==layer)return;
    const texture=model.shieldTexture(look.view,sh.cracks?'cracked':'intact',data),im=artwork?.available(texture);if(!im)return;
    const box=model.squashBox(model.shieldBox(look.view,sh.angle,b.radius+p.feel.shieldGap,p.feel.shieldArc,p.projection.upright,im,data),look.squash);
    ctx.save();ctx.globalAlpha=sh.up;ctx.translate(b.x+box.gx,b.y+box.gy);ctx.scale(box.mirror?-1:1,p.projection.upright);
    ctx.drawImage(im,box.mirror?-box.left-box.width:box.left,box.top,box.width,box.height);ctx.restore();
  }
  function particles(ctx,p,time){
    const dt=M.travel(time),fade=1-dt/M.travel(K.holdMs);
    for(const particle of p.particles){
      ctx.globalAlpha=Math.max(0,(particle.life-dt)/(particle.max??p.particleLife));
      ctx.fillStyle=p.colors[particle.color]??p.colors.warning;
      circle(ctx,particle.x+(particle.vx??0)*dt,particle.y+(particle.vy??0)*dt,particle.size??K.particleSize);
    }
    for(const ring of p.rings){const age=1-Math.max(0,ring.life-dt)/(ring.max??p.ringLife);
      ctx.globalAlpha=Math.max(0,1-age);ctx.strokeStyle=p.colors[ring.colour]??p.colors.warning;
      ctx.lineWidth=2;ctx.beginPath();ctx.arc(ring.x,ring.y,1+age*(ring.big??K.ringSize),0,Math.PI*2);ctx.stroke();}
    ctx.globalAlpha=fade;
    ctx.globalAlpha=1;
  }
  function beams(ctx,p,time,artwork){
    const dt=M.travel(time),fade=1-dt/M.travel(K.holdMs),fx=p.boss.fx,b=p.boss.targets[0];
    if(fx?.warn?.def.id==='beam'&&fx.t>=p.feel.windup){
      ctx.save();ctx.translate(b.x,b.y);ctx.rotate(fx.warn.angle);ctx.globalAlpha=fade;
      root.LoftRumbleBossFight?.beam(ctx,{fx,feel:p.feel,radius:b.radius,length:Math.hypot(p.width,p.height),
        reduced:true,image:name=>artwork?.available(name),tint:{fire:p.colors['beam-fire'],core:p.colors['beam-core']},
        ends:p.beams?.ends,angle:p.beams?.angle,upright:p.projection.upright});ctx.restore();
    }
    ctx.save();ctx.globalAlpha=fade;
    root.LoftRumbleHeroFx?.draw(ctx,{effects:p.teamEffects,bolts:p.bolts,enemy:b,enemyRadius:b.radius,
      image:name=>artwork?.available(name),colour:key=>p.colors[key],reduced:true,upright:p.projection.upright,danger:false});
    ctx.restore();
  }
  // No game/session object enters this renderer. Resource lookup cannot access combat callbacks.
  function draw(ctx,p,elapsed,reduced,resources){
    const time=reduced?K.holdMs:elapsed,poses=Object.values(p.bodies).map(b=>M.pose(b,p,elapsed,reduced));
    ctx.save();ctx.translate(0,p.projection.offset);ctx.scale(1,p.projection.factor);
    for(const b of p.bumpers)resources.artwork?.bumper(ctx,p.bumperSkin,b,p.feel.bumperRadius,b.hit,p.projection.upright);
    if(p.heart)resources.artwork?.paint(ctx,'pickup-heart',p.heart.x,p.heart.y,p.feel.bumperRadius*2);
    ctx.save();ctx.globalAlpha=K.shadowAlpha;ctx.fillStyle=p.colors.foreground;
    for(const b of [...poses,...p.boss.targets]){const r=b.radius??p.radius;ctx.beginPath();ctx.ellipse(b.x,b.y,r,r*K.shadowHeight,0,0,Math.PI*2);ctx.fill();}ctx.restore();
    beams(ctx,p,time,resources.artwork);
    const ordered=[...poses.map(b=>({b,y:b.y})),...p.boss.targets.map(b=>({b,y:b.y,boss:true}))].sort((a,b)=>a.y-b.y);
    for(const item of ordered){if(item.boss){shield(ctx,item.b,p,resources.artwork,'rear');boss(ctx,item.b,p,time,resources.artwork);shield(ctx,item.b,p,resources.artwork,'front');}
      else residents(ctx,item.b,p,resources.images,time);}
    particles(ctx,p,time);ctx.restore();
  }
  root.LoftRumbleFinishRenderer=Object.freeze({draw});
})(globalThis);
