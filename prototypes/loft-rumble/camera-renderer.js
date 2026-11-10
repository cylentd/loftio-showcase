(function(root){
  'use strict';
  const config=root.LoftRumbleCameraConfig;
  // Upright art is stretched about the collider centre so the floor squash leaves it standing; its rectangles stretch the same way.
  function upright(session,target,rect){
    const scale=session.uprightScale;
    return {...rect,y:target.y+(rect.y-target.y)*scale,height:rect.height*scale,groundY:target.y+(rect.groundY-target.y)*scale};
  }
  function bounds(session,target){
    if(root.LoftRumbleStorybook.enabled(session))return upright(session,target,root.LoftRumbleStorybook.bossBounds(target.x,target.y,target.radius));
    const size=target.radius*(session.game.artwork?.metrics.bossSize??2);
    return {x:target.x-size/2,y:target.y-size/2,width:size,height:size,groundY:target.y};
  }
  function occluders(session,target){
    if(!root.LoftRumbleStorybook.enabled(session))return [bounds(session,target)];
    return root.LoftRumbleStorybook.bossParts(target.x,target.y,target.radius).map(rect=>upright(session,target,rect));
  }
  function info(session){
    const {s,ids,C}=session.game;
    const entries=[...session.enemies().map(target=>({id:target.id,y:bounds(session,target).groundY,target})),...ids.map(id=>({id,y:s.bodies[id].y}))];
    const order=session.shallow?session.projection.sort(entries):entries;
    const hiders=id=>session.shallow?session.enemies().filter(target=>session.projection.occluded({...s.bodies[id],radius:C.radius},occluders(session,target))).map(target=>target.id):[];
    // The ring follows any hidden resident. The boss fades only for one that has stopped there: the player tracks a passing one by
    // its motion, and a boss that blinks on every pass reads as a glitch (owner review 2026-11-09).
    const silhouettes=ids.filter(id=>hiders(id).length),faded=[...new Set(silhouettes.filter(id=>!s.bodies[id].moving).flatMap(hiders))];
    return {order:order.map(item=>item.id),silhouettes,faded,entries:order};
  }
  function ground(session){
    const {ctx,s,ids,C}=session.game;
    const heat=root.LoftRumbleHeat.style(s.hits); // a hot combo makes the trail longer, wider and brighter, in the tier's colour
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=heat?session.game.colors[heat.colour]:config.silhouetteColor;
    const alpha=heat?.trailAlpha??config.trailAlpha,width=heat?.trailWidth??config.trailWidth;
    for(const id of ids){
      const points=s.cameraScene.paths[id]?.slice(-(heat?.trailSamples??config.trailSamples));
      if(!s.bodies[id].moving||!points?.length)continue;
      // Drawn a segment at a time so the trail tapers and fades from the resident back to its tail.
      for(let index=1;index<points.length;index++){
        const share=index/(points.length-1);
        ctx.globalAlpha=alpha*share;ctx.lineWidth=width*share;
        if(heat?.rainbow)ctx.strokeStyle=root.LoftRumbleHeat.trailColour(index,s.clock);
        ctx.beginPath();ctx.moveTo(points[index-1].x,points[index-1].y);ctx.lineTo(points[index].x,points[index].y);ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();ctx.fillStyle=config.shadowColor;ctx.globalAlpha=config.contactShadowAlpha;
    for(const body of [...session.enemies().map(target=>({...target,y:bounds(session,target).groundY})),...ids.map(id=>({...s.bodies[id],radius:C.radius}))]){
      ctx.beginPath();ctx.ellipse(body.x,body.y,body.radius,body.radius*config.contactShadowHeight,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function edges(session){
    if(root.LoftRumbleStorybook.enabled(session))return;
    if(!session.shallow)return;
    const {ctx,s,C}=session.game,depth=config.wallDepth;
    ctx.save();ctx.fillStyle=config.sideColor;ctx.fillRect(0,C.hudTop,s.w,depth);
    ctx.fillRect(0,C.hudTop,depth,s.h-C.hudTop-C.hudBottom);ctx.fillRect(s.w-depth,C.hudTop,depth,s.h-C.hudTop-C.hudBottom);
    ctx.strokeStyle=config.edgeColor;ctx.lineWidth=config.lineWidth;ctx.strokeRect(depth,C.hudTop+depth,s.w-depth*2,s.h-C.hudBottom-C.hudTop-depth);ctx.restore();
  }
  function draw(session,font){
    const game=session.game,{ctx,s,C}=game;
    root.LoftRumbleHeat.dim(game);session.projection.begin(ctx);edges(session);ground(session);root.LoftRumbleHeat.drawFlames(game);
    game.drawWarn();game.drawHeart();game.drawBumpers();game.drawAttack();game.drawFlashes();
    const state=info(session);
    for(const item of state.entries){
      if(item.target){
        session.bossFade=state.faded.includes(item.target.id)?config.occludedBossAlpha:1;
        session.withEnemy(item.target,()=>{game.drawEnemy(false);game.drawShield();});
        session.bossFade=1;
      }
      else game.drawBodies(font,item.id,false,false);
    }
    game.drawHornBits();game.drawParticles();game.artwork?.effects(ctx,s,C,game.FEEL,game.enemy(),game.still());game.drawBodyEffects(font);
    for(const id of state.silhouettes){const body=s.bodies[id];ctx.save();ctx.strokeStyle=config.silhouetteColor;ctx.globalAlpha=config.silhouetteAlpha;ctx.lineWidth=config.silhouetteWidth;ctx.beginPath();ctx.arc(body.x,body.y,C.radius+config.silhouettePadding,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(s.phase==='play')game.aim(font);
    if(session.debugEnabled)root.LoftRumbleCameraDebug.draw(session);
  }
  root.LoftRumbleCameraRenderer={draw,info,bounds};
})(globalThis);
