(function(root){
  'use strict';
  const K=root.LoftRumbleFinishConstants;
  const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
  // Integral of a smooth ramp followed by cubic deceleration. No accumulated deltas.
  function travel(elapsed){
    const t=clamp(elapsed-K.impactMs,0,K.followMs),r=K.rampMs,d=K.followMs-r;
    if(t<=r)return K.speed*t*t/(2*r*K.milliseconds);
    const u=(t-r)/d;
    return K.speed*(r/2+d*(1-(1-u)**(K.settlePower+1))/(K.settlePower+1))/K.milliseconds;
  }
  function capture(o){
    const {s,C,FEEL,camera}=o;
    const bodies=Object.fromEntries(o.ids.map(id=>{
      const b=s.bodies[id],pose=o.contactPose(id);
      return [id,{id,x:b.x,y:b.y,vx:b.vx,vy:b.vy,angle:b.angle,pulse:b.pulse,
        moving:b.moving,charge:b.charge,stun:b.stun,pose,squash:b.squash,
        size:o.artSize()*o.splashScale(id)*(FEEL.artBalance[id]??1)}];
    }));
    const targets=camera?.enemies()??[{...o.enemy(),radius:C.enemyRadius}];
    return {version:1,bodies,particles:s.particles,rings:s.rings,bolts:s.bolts,
      teamEffects:s.teamEffects,hornBits:s.hornBits,heart:s.heart,
      boss:{targets,fx:s.attackFx,reaction:s.enemyHit,clock:s.clock,shield:s.shield,
        finale:s.finale,stagger:s.stagger,flash:s.enemyFlash},
      beams:beamCapture(s.attackFx,targets[0],o),
      bumpers:o.bumperSpots().map((p,i)=>({...p,hit:s.bumperHits[i]/FEEL.bumperFlash})),
      bounds:{left:C.radius+C.padding,right:s.w-C.radius-C.padding,
        top:C.hudTop+C.radius+C.padding,bottom:s.h-C.hudBottom-C.radius-C.padding},
      projection:{factor:camera?.active?camera.projection.factor:1,
        offset:camera?.active?camera.projection.project({x:0,y:0}).y:0,
        upright:camera?.shallow?camera.uprightScale:1},
      width:s.w,height:s.h,radius:C.radius,particleLife:C.particleLife,ringLife:C.ringLife,
      feel:FEEL,timing:o.RT,colors:o.colors,skin:o.skin,bumperSkin:o.artwork?.bumperSkin(),
      storybook:!!camera&&root.LoftRumbleStorybook.enabled(camera)};
  }
  function beamCapture(fx,b,o){
    if(fx?.warn?.def.id!=='beam')return null;
    const model=root.LoftRumbleBossFightModel,data=root.LoftRumbleBossFightData;
    const length=Math.hypot(o.s.w,o.s.h);
    return {angle:fx.warn.angle,length,
      segments:model.beamSegments(fx,o.FEEL,b.radius,length,data,false),
      ends:model.wallReach(b,fx.warn.angle,{left:0,top:o.C.hudTop,right:o.s.w,bottom:o.s.h-o.C.hudBottom},data)};
  }
  function pose(body,snapshot,elapsed,reduced){
    const time=travel(reduced?K.holdMs:elapsed),end=travel(K.holdMs),bounds=snapshot.bounds;
    // Scale the whole trajectory at an edge; never bounce, collide or change direction.
    const dx=body.moving?body.vx*end:0,dy=body.moving?body.vy*end:0;
    const room=(p,d,lo,hi)=>d>0?(hi-p)/d:d<0?(lo-p)/d:1;
    const limit=clamp(Math.min(1,room(body.x,dx,bounds.left,bounds.right),room(body.y,dy,bounds.top,bounds.bottom)),0,1);
    const progress=end?time/end:0,settle=1-progress;
    return {...body,x:body.x+dx*limit*progress,y:body.y+dy*limit*progress,
      angle:body.angle+dx*limit*progress*K.rotationPerPixel,
      pose:{x:body.pose.x*settle,y:body.pose.y*settle,
        sx:1+(body.pose.sx-1)*settle,sy:1+(body.pose.sy-1)*settle,
        rotation:body.pose.rotation*settle},pulse:(body.pulse??0)*settle};
  }
  root.LoftRumbleFinishModel=Object.freeze({capture,travel,pose});
})(globalThis);
