// Swarm frame-rate bench (?stage=swarm-bench&n=60). Pure functions, no clock and no dice: how many monsters, which kinds, where
// they start, how they march and wrap, which kind replaces a defeat, and the fps window the readout shows. The model
// (swarm-model.js) calls the first five in its bench mode; the page feeds frame times to stats(). Numbers: swarm-data.js BENCH.
(function(root){
  'use strict';
  const D=root.LoftRumbleSwarmData,B=D.BENCH;
  const MS_PER_S=1000,ONE_DECIMAL=10;

  // ?n= as a whole number in N_MIN..N_MAX; N_DEFAULT when it is missing or not a number.
  function clampN(raw){
    const v=parseInt(raw,10); // magic-ok: radix
    return Number.isFinite(v)?Math.min(B.N_MAX,Math.max(B.N_MIN,v)):B.N_DEFAULT;
  }

  // The bench's start options from the page URL: {n} when the stage is the bench, else undefined (the page's other stages).
  const fromSearch=(mode,search)=>mode==='bench'?{n:clampN(new URLSearchParams(search).get(B.PARAM))}:undefined;

  // n kinds in turn, so every kind is within one of the others.
  const kinds=n=>Array.from({length:n},(_,i)=>D.IDS[i%D.IDS.length]);

  // Where the marching line wraps, arena units.
  const wrapY=arena=>arena.h*B.WRAP_FROM;

  // n starting places spread evenly over the arena, between each kind's top inset and the wrap line. The same every call.
  function layout(n,arena){
    return kinds(n).map((kind,i)=>{
      const e=D.EDGE[kind],top=D.TOP_INSET[kind],fx=((i+1)*B.SPREAD_X)%1,fy=((i+1)*B.SPREAD_Y)%1;
      return{kind,x:e+fx*(arena.w-2*e),y:top+fy*(wrapY(arena)-top)};
    });
  }

  // One step of the march: down at MARCH_SPEED, back to the kind's top inset once past the wrap line. x never changes.
  function march(m,dt,arena){
    const y=m.y+B.MARCH_SPEED*dt;
    return{x:m.x,y:y>=wrapY(arena)?D.TOP_INSET[m.kind]:y};
  }

  // The kind that has the fewest live monsters (ties: the first in D.IDS), so a run of defeats keeps the mix even.
  function kindToAdd(liveKinds){
    const count=id=>liveKinds.filter(k=>k===id).length;
    return D.IDS.reduce((best,id)=>count(id)<count(best)?id:best,D.IDS[0]);
  }

  // The readout over frames [{at, ms}] (at: when the frame ended, ms; ms: its length): those in the last WINDOW_S before `now`.
  // avgFps is frames over total time, lowFps the fps of the mean of the slowest LOW_SHARE of frames (at least one), worstMs the longest.
  function stats(frames,now){
    const recent=frames.filter(f=>f.at>now-B.WINDOW_S*MS_PER_S);
    if(!recent.length)return{avgFps:0,lowFps:0,worstMs:0,frames:0};
    const sorted=recent.map(f=>f.ms).sort((a,b)=>b-a),total=sorted.reduce((a,b)=>a+b,0);
    const slow=sorted.slice(0,Math.max(1,Math.ceil(sorted.length*B.LOW_SHARE))),slowMean=slow.reduce((a,b)=>a+b,0)/slow.length;
    const round=v=>Math.round(v*ONE_DECIMAL)/ONE_DECIMAL;
    return{avgFps:round(sorted.length/total*MS_PER_S),lowFps:round(MS_PER_S/slowMean),worstMs:sorted[0],frames:sorted.length};
  }

  const api=Object.freeze({clampN,fromSearch,kinds,layout,march,kindToAdd,stats,wrapY});
  root.LoftRumbleSwarmBench=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
