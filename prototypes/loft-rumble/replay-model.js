(function(root){
  'use strict';
  /** @typedef {{t:number}} Snapshot  one painted frame; t is fight time in seconds */
  /** @typedef {{cap:number,frames:Snapshot[]}} Recording */
  /** @typedef {{mode:'idle'|'playing'|'paused'|'ended',t:number,end:number}} Player */
  const capFor=(seconds,rate)=>Math.round(seconds*rate);
  const create=cap=>({cap,frames:[]});
  const clear=rec=>{rec.frames.length=0};
  function record(rec,snapshot){rec.frames.push(snapshot);if(rec.frames.length>rec.cap)rec.frames.shift()}
  const first=rec=>rec.frames[0]?.t??0;
  const duration=rec=>rec.frames.length>1?rec.frames[rec.frames.length-1].t-first(rec):0;
  // The snapshot at player time t (seconds from the first kept snapshot): the latest one at or before t, clamped to the ends.
  function frameAt(rec,t){
    const {frames}=rec;if(!frames.length)return null;
    const at=t+first(rec);let low=0,high=frames.length-1;
    while(low<high){const mid=(low+high+1)>>1;if(frames[mid].t<=at)low=mid;else high=mid-1}
    return frames[low];
  }
  const idle=()=>({mode:'idle',t:0,end:0});
  const clamp=(t,end)=>Math.min(end,Math.max(0,t));
  const finish=(t,end)=>t>=end?{mode:'ended',t:end,end}:null;
  // The player lifecycle as one pure transition: next(state, event) -> state. Events: play{end}, pause, seek{t}, tick{dt,speed}, exit.
  function next(state,event){
    const {mode,t,end}=state;
    switch(event.type){
      case 'play':
        if(mode==='idle')return {mode:'playing',t:0,end:event.end};
        if(mode==='paused')return {mode:'playing',t,end};
        if(mode==='ended')return {mode:'playing',t:0,end};
        return state;
      case 'pause':return mode==='playing'?{mode:'paused',t,end}:state;
      case 'seek':{
        if(mode==='idle')return state;
        const to=clamp(event.t,end);
        return finish(to,end)??{mode:mode==='playing'?'playing':'paused',t:to,end};
      }
      case 'tick':return mode==='playing'?finish(t+event.dt*event.speed,end)??{mode,t:t+event.dt*event.speed,end}:state;
      case 'exit':return idle();
      default:return state;
    }
  }
  root.LoftRumbleReplayModel=Object.freeze({capFor,create,clear,record,frameAt,duration,idle,next});
})(globalThis);
