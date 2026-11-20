(function(root){
  'use strict';
  const defaults=root.LoftRumbleWhiplashData,turn=2*Math.PI;
  function initial({origin,facing,reach,config=defaults,rig}){
    if(!origin||!Number.isFinite(origin.x)||!Number.isFinite(origin.y)||!Number.isFinite(facing)
      ||!Number.isFinite(reach)||reach<0)throw new TypeError('Invalid Whiplash geometry');
    if(!config||!['prepare','telegraph','strike','recover','rearAngle','totalDamage','rosterSize']
      .every(key=>Number.isFinite(config[key])&&config[key]>0)||config.rearAngle>=turn)
      throw new TypeError('Invalid Whiplash configuration');
    return {phase:'prepare',elapsed:0,origin:Object.freeze({x:origin.x,y:origin.y}),facing,reach,
      struck:false,rig,config:Object.freeze({...config})};
  }
  function phaseAt(elapsed,config){
    let start=0;
    for(const phase of ['prepare','telegraph','strike','recover']){
      const duration=config[phase];
      if(elapsed<start+duration-defaults.clockEpsilon)return {phase,start,duration};
      start+=duration;
    }
    return {phase:'done',start:elapsed,duration:0};
  }
  function next(state,event){
    if(['reset','cancel','terminal'].includes(event?.type))return {state:null,strikeDue:false};
    if(!state||event?.type!=='tick'||event.running!==true||!Number.isFinite(event.dt)||event.dt<0)
      return {state,strikeDue:false};
    const config=state.config,total=config.prepare+config.telegraph+config.strike+config.recover;
    const elapsed=Math.min(total,state.elapsed+event.dt),phase=phaseAt(elapsed,config).phase;
    const struck=state.struck||elapsed>=config.prepare+config.telegraph-defaults.clockEpsilon;
    return {state:{...state,elapsed,phase,struck},strikeDue:struck&&!state.struck};
  }
  function project(state){
    if(!state)return null;
    const {phase,start,duration}=phaseAt(state.elapsed,state.config),half=(turn-state.config.rearAngle)/2;
    return {phase,phaseElapsed:Math.max(0,state.elapsed-start),phaseDuration:duration,
      origin:{...state.origin},facing:state.facing,reach:state.reach,
      startAngle:state.facing-half,endAngle:state.facing+half,
      rearStart:state.facing+half,rearEnd:state.facing-half+turn};
  }
  function segmentDistance(dx,dy,angle,reach){
    const axisX=Math.cos(angle),axisY=Math.sin(angle);
    const along=Math.max(0,Math.min(reach,dx*axisX+dy*axisY));
    return Math.hypot(dx-along*axisX,dy-along*axisY);
  }
  function contains(state,body,bodyRadius){
    if(!state||!body||!Number.isFinite(body.x)||!Number.isFinite(body.y)
      ||!Number.isFinite(bodyRadius)||bodyRadius<0)return false;
    const dx=body.x-state.origin.x,dy=body.y-state.origin.y,distance=Math.hypot(dx,dy);
    const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-state.facing),Math.cos(Math.atan2(dy,dx)-state.facing));
    const half=(turn-state.config.rearAngle)/2,epsilon=defaults.geometryEpsilon;
    if(Math.abs(delta)<=half+epsilon)return distance<=state.reach+bodyRadius+epsilon;
    return Math.min(segmentDistance(dx,dy,state.facing-half,state.reach),
      segmentDistance(dx,dy,state.facing+half,state.reach))<=bodyRadius+epsilon;
  }
  function arenaReach(origin,width,height){
    return Math.hypot(Math.max(Math.abs(origin.x),Math.abs(width-origin.x)),
      Math.max(Math.abs(origin.y),Math.abs(height-origin.y)));
  }
  root.LoftRumbleWhiplashModel=Object.freeze({initial,next,project,contains,arenaReach});
})(globalThis);
