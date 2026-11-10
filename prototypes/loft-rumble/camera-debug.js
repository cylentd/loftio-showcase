(function(root){
  'use strict';
  const config=root.LoftRumbleCameraConfig;
  function path(ctx,points,color){
    if(!points?.length)return;
    ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(const point of points.slice(1))ctx.lineTo(point.x,point.y);
    ctx.stroke();
  }
  function draw(session){
    const {ctx,s,C,FEEL,ids,bumperSpots,artSize,contactPose,splashScale,still}=session.game;
    ctx.save();ctx.lineWidth=config.lineWidth;ctx.strokeStyle=config.gridColor;
    ctx.beginPath();
    for(let axis=config.grid;axis<s.w;axis+=config.grid){ctx.moveTo(axis,C.hudTop);ctx.lineTo(axis,s.h-C.hudBottom);}
    for(let axis=C.hudTop;axis<s.h-C.hudBottom;axis+=config.grid){ctx.moveTo(0,axis);ctx.lineTo(s.w,axis);}ctx.stroke();
    for(const body of [...session.enemies(),...ids.map(id=>({...s.bodies[id],radius:C.radius})),...bumperSpots().map(point=>({...point,radius:FEEL.bumperRadius}))]){
      ctx.strokeStyle=config.physicsColor;ctx.beginPath();ctx.arc(body.x,body.y,body.radius,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle=config.anchorColor;ctx.beginPath();ctx.moveTo(body.x-config.anchorSize,body.y);ctx.lineTo(body.x+config.anchorSize,body.y);ctx.moveTo(body.x,body.y-config.anchorSize);ctx.lineTo(body.x,body.y+config.anchorSize);ctx.stroke();
    }
    ctx.strokeStyle=config.boundsColor;ctx.globalAlpha=config.boundsAlpha;
    if(root.LoftRumbleStorybook.enabled(session))for(const target of session.enemies()){
      const rect=root.LoftRumbleCameraRenderer.bounds(session,target);
      ctx.strokeRect(rect.x,rect.y,rect.width,rect.height);
      ctx.save();ctx.strokeStyle=config.anchorColor;ctx.beginPath();ctx.moveTo(target.x-config.anchorSize,rect.groundY);ctx.lineTo(target.x+config.anchorSize,rect.groundY);ctx.moveTo(target.x,rect.groundY-config.anchorSize);ctx.lineTo(target.x,rect.groundY+config.anchorSize);ctx.stroke();ctx.restore();
    }
    for(const id of ids){
      const body=s.bodies[id],pose=contactPose(id),size=artSize(),held=s.held===id;
      const stretch=held?Math.min(.2,Math.hypot(s.px-s.ax,s.py-s.ay)/600):body.pulse;
      const scale=splashScale(id)*(held&&s.perfectPulse>0?1+FEEL.perfectPulse*s.perfectPulse/FEEL.perfectPulseLife:1);
      ctx.save();ctx.translate(body.x+pose.x,body.y+pose.y);ctx.scale(1,session.uprightScale);
      if(body.squash&&!still()){const amount=FEEL.wallSquash*body.squash.life/FEEL.wallSquashLife,angle=Math.atan2(body.squash.ny,body.squash.nx);ctx.rotate(angle);ctx.scale(1-amount,1+amount*.6);ctx.rotate(-angle);}
      ctx.rotate(body.angle+pose.rotation);ctx.scale((1+stretch)*pose.sx*scale,(1-stretch*.5)*pose.sy*scale);ctx.beginPath();ctx.rect(-size/2,-size/2,size,size);ctx.stroke();ctx.restore();
    }
    ctx.globalAlpha=1;
    for(const points of Object.values(s.cameraScene.paths))path(ctx,points,config.actualColor);
    if(session.forecast)path(ctx,session.forecast.route.samples,config.forecastColor);
    ctx.restore();
  }
  root.LoftRumbleCameraDebug={draw};
})(globalThis);
