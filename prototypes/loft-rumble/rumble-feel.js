// Loft Rumble hit feel, pure: the hit-stop gate and the shake model. No DOM, no clock, no random; the page passes fight time in.
// Numbers: rumble-feel-data.js. Design: studies/boss-lag.md, option (a).
(function(root){
  'use strict';
  const D=root.LoftRumbleFeelData;
  // Arm a hit-stop of `length` seconds at fight time `now`. A stop that would start inside STOP_WINDOW of the last stop's start arms none.
  // Hits at the same instant are one impact (contact plus enemy hit in one frame): the longer stop wins, as before the gate.
  // kill=true (the killing blow) is never gated and does not use up the window.
  function armStop(s,length,now,{kill=false}={}){
    if(!(length>0))return;
    if(kill){s.hitStop=Math.max(s.hitStop||0,length);return}
    const since=s.stopAt==null?Infinity:now-s.stopAt;
    if(since>0&&since<D.STOP_WINDOW)return;
    if(since>0)s.stopAt=now;
    s.hitStop=Math.max(s.hitStop||0,length);
  }
  const decayed=(e,now)=>e.amp*Math.exp(-(now-e.t0)/D.SHAKE_DECAY);
  // Turn the scalar `s.shake` (what every writer sets, capped by the writer) into one stored event: start time, direction, amplitude.
  // The direction is s.shakeDir (the hit's), else the next golden-angle step. Drops events that have decayed below SHAKE_FLOOR.
  function ingestShake(s,now){
    s.shakes=(s.shakes||[]).filter(e=>decayed(e,now)>=D.SHAKE_FLOOR);
    if(s.shake>=D.SHAKE_FLOOR){
      const d=s.shakeDir,len=d?Math.hypot(d.x,d.y):0;
      let dx,dy;
      if(len>0){dx=d.x/len;dy=d.y/len}else{const a=(s.shakeN=(s.shakeN||0)+1)*D.GOLDEN_ANGLE;dx=Math.cos(a);dy=Math.sin(a)}
      s.shakes.push({t0:now,dx,dy,amp:s.shake});
    }
    s.shake=0;s.shakeDir=null;
  }
  // Ease a magnitude under `cap`: unchanged up to the knee, then tanh with slope 1 at the knee, so no kink and never above the cap.
  function soften(m,cap){
    const k=cap*D.SHAKE_KNEE;
    return m<=k?m:k+(cap-k)*Math.tanh((m-k)/(cap-k));
  }
  // The arena offset at fight time `now`: the sum of live events, each a damped sine along its direction, eased under `cap`.
  function shakeOffset(events,now,cap){
    let x=0,y=0;
    for(const e of events){
      const age=now-e.t0;if(age<0)continue;
      const v=decayed(e,now)*Math.sin(2*Math.PI*D.SHAKE_FREQ*age);
      x+=e.dx*v;y+=e.dy*v;
    }
    const m=Math.hypot(x,y);
    if(!m)return {x:0,y:0};
    const k=soften(m,cap)/m;
    return {x:x*k,y:y*k};
  }
  root.LoftRumbleFeel=Object.freeze({armStop,ingestShake,shakeOffset});
})(globalThis);
