(function(root){
  'use strict';
  const {CAP_SECONDS,RATE,KEEP_SHARE,SPEEDS}=root.LoftRumbleReplayData;
  const Model=root.LoftRumbleReplayModel,Snapshot=root.LoftRumbleReplaySnapshot;
  const FLAG='replay',OFF='0';
  // Wires the recorder and the player into the page. Every page gets one (owner, look #535, 2026-11-22); ?replay=0 turns it off, and then
  // this returns null and the page runs as before. `frame(real, advance, draw)` replaces the page's `advance(real); draw()` pair.
  // `sync()` repaints what draw() does not (the DOM hero cards, QA #535) after a replayed or restored state.
  function attach({s,draw,sync=()=>{},search}){
    if(new URLSearchParams(search).get(FLAG)===OFF)return null;
    const rec=Model.create(Model.capFor(CAP_SECONDS,RATE));
    let player=Model.idle(),speed=1,live=null,fightKey=null,clock=0,lastKept=-Infinity,lastSnap=null; // lastSnap: the previous recorded snapshot, which the next shares unchanged parts with
    const replaying=()=>player.mode!=='idle';
    // The fight's one paused state, read from the page's own flags (no flag of ours): the pause menu and the help overlay (userPaused),
    // a hidden tab (paused) and a cinematic (cinematic). The recorder and the pause stone's glyph both read it (#624).
    const fightPaused=()=>!!(s.userPaused||s.paused||s.cinematic);
    const recording=()=>s.phase==='play'||root.LoftRumbleBattleEnd.presenting(s.battleEnd);
    // reset() gives every battle a new s.fightStats and apply() writes copies, so the object kept after each show() changes only when a new battle began.
    let shownStats=null;
    function show(){const snap=Model.frameAt(rec,player.t);if(snap){Snapshot.apply(s,snap);shownStats=s.fightStats;sync();draw()}}
    // A new battle during a replay (any path that calls reset()): drop the replay and the old recording, and leave the new state alone.
    function abandon(){player=Model.idle();live=null;Model.clear(rec);clock=0;lastKept=-Infinity;lastSnap=null;fightKey=null}
    // A new fight is a new `s.bodies` (reset() builds it), so Play Again starts an empty recording.
    function keep(real,wasLive){
      if(s.bodies!==fightKey){fightKey=s.bodies;Model.clear(rec);clock=0;lastKept=-Infinity;lastSnap=null}
      if(fightPaused())return; // a paused fight (menu, help, hidden tab, cinematic) does not advance, so its frames are neither kept nor timed (QA #535, #624)
      clock+=real;
      // The frame that ends the fight is kept too: it was live when it started.
      if((wasLive||recording())&&clock-lastKept>=KEEP_SHARE/RATE){lastKept=clock;lastSnap=Snapshot.take(s,clock,false,lastSnap);Model.record(rec,lastSnap)}
    }
    function frame(real,advance,drawLive){
      if(replaying()&&s.fightStats!==shownStats)abandon();
      if(replaying()){player=Model.next(player,{type:'tick',dt:real,speed});show();return}
      const wasLive=recording();
      advance(real);keep(real,wasLive);drawLive(); // the snapshot is taken after advance and before draw, so it holds exactly what that draw paints
    }
    function start(){
      if(replaying()){if(player.mode!=='playing')player=Model.next(player,{type:'play'});return true}
      if(s.phase!=='over'||Model.duration(rec)<=0)return false; // input during a replay would change a fight the player is only watching
      live=Snapshot.take(s,0,true);
      player=Model.next(player,{type:'play',end:Model.duration(rec)});show();return true;
    }
    function pause(){player=Model.next(player,{type:'pause'})}
    function seek(t){player=Model.next(player,{type:'seek',t});if(replaying())show()}
    function setSpeed(n){if(SPEEDS.includes(n))speed=n}
    function exit(){
      if(!replaying())return;
      // apply() writes copies, so the restored s.bodies is a new object: re-key it, or the next live frame would clear the recording.
      player=Model.next(player,{type:'exit'});Snapshot.apply(s,live);fightKey=s.bodies;live=null;sync();draw();
    }
    const state=()=>({mode:player.mode,t:player.t,end:Model.duration(rec),speed,frames:rec.frames.length});
    const api={frame,start,pause,seek,setSpeed,exit,state,paused:fightPaused};
    root.LoftRumbleReplay=api;
    return api;
  }
  root.LoftRumbleReplayRuntime=Object.freeze({attach});
})(globalThis);
