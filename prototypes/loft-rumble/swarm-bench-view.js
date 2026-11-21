// Swarm bench readout (?stage=swarm-bench): a small panel with the rolling-window fps, the 1% low, the worst frame and the
// monster count. The page calls frame(now) once per animation frame with the browser's timestamp; the numbers come from
// LoftRumbleSwarmBench.stats. It exists only on the bench stage, and draws nothing else.
(function(root){
  'use strict';
  const D=root.LoftRumbleSwarmData,B=root.LoftRumbleSwarmBench;
  const MS_PER_S=1000;
  const LIVE=Object.freeze({alive:'alive',spawning:'spawning'}); // the model's life names that count as on the field
  const REFRESH_MS=250;    // the text changes at 4 Hz, so reading it costs no frames
  const GAP_MS=1000;        // a frame longer than this was a hidden tab or a pause, not rendering: it is not sampled
  const COPY=Object.freeze({fps:'avg fps',low:'1% low fps',worst:'worst frame ms',count:'monsters',window:'last 10 s'});
  const STYLE='position:fixed;left:6px;top:6px;z-index:50;padding:6px 8px;border-radius:6px;background:rgba(20,14,10,.78);'
    +'color:#fff;font:12px/1.35 ui-monospace,Consolas,monospace;pointer-events:none;white-space:pre';

  // `monsters` returns the model's monster list (read each refresh; the readout counts the live ones). From then on frame(now)
  // samples; before install it does nothing, so the page can call it on every frame of every stage.
  let sample=()=>{};
  const frame=now=>sample(now);
  function install(doc,monsters){
    const el=doc.createElement('div');
    el.id='swarm-bench-readout';el.style.cssText=STYLE;doc.body.append(el);
    const count=()=>monsters().filter(m=>m.life===LIVE.alive||m.life===LIVE.spawning).length;
    const frames=[];let last=0,shownAt=-Infinity;
    sample=now=>{
      if(last&&now-last<GAP_MS)frames.push({at:now,ms:now-last});
      last=now;
      while(frames.length&&frames[0].at<=now-D.BENCH.WINDOW_S*MS_PER_S)frames.shift();
      if(now-shownAt<REFRESH_MS)return;
      shownAt=now;
      const s=B.stats(frames,now);
      el.textContent=[COPY.fps+' '+s.avgFps,COPY.low+' '+s.lowFps,COPY.worst+' '+s.worstMs.toFixed(1),COPY.count+' '+count(),COPY.window].join('\n');
    };
  }
  root.LoftRumbleSwarmBenchView=Object.freeze({install,frame});
})(typeof globalThis!=='undefined'?globalThis:this);
