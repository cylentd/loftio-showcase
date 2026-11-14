// Loft Rumble Training stage: the only module that writes the battle state `s` for the tutorial. It turns the game's own events
// into model events (rumble-tutorial-model.js), stages each beat from the script (rumble-tutorial-script.js) and tells the view
// what to show. Every hook is a no-op until install(), and during the aim forecast (camera.predicting).
(function(root){
  'use strict';
  const model=root.LoftRumbleTutorialModel,script=root.LoftRumbleTutorialScript,beats=script.beats;
  // host: what the page hands over at install. timer: real seconds in the current phase. recover: real seconds left before a
  // caught dodge is staged again. internal: true while this module resets the page, so that reset is not read as a quit.
  let host=null,view=null,state=model.INITIAL,timer=0,recover=0,regrant=0,internal=false,home={};
  const predicting=()=>!!host?.camera()?.predicting;
  const running=()=>!!host&&state.status==='running';
  const spec=()=>beats[state.beat];

  function read(){
    try{
      const raw=localStorage.getItem(script.storageKey);if(raw==null)return null;
      const record=JSON.parse(raw);
      return record?.version===script.version&&script.statuses.includes(record.status)?record:null;
    }catch{return null}
  }
  // Storage denial leaves a playable session: the record simply lives only in this page.
  function save(status){
    if(predicting())return;
    try{localStorage.setItem(script.storageKey,JSON.stringify({version:script.version,status}))}catch{}
  }

  // ---- Staging: the stage writes the battle state here and nowhere else ----
  function spot(place,id){
    if(place==null)return {x:host.s.w*script.parkX,y:home[id].y};
    if(place==='home')return home[id];
    if(Array.isArray(place))return {x:host.s.w*place[0],y:host.s.h*place[1]};
    const {from,share}=place.lane,boss=host.enemy(),start=home[from];
    return {x:start.x+(boss.x-start.x)*share,y:start.y+(boss.y-start.y)*share};
  }
  function place(id,where){
    const body=host.s.bodies[id];
    host.stop(body);
    Object.assign(body,spot(where,id),{vx:0,vy:0,moving:false,charge:1,stun:0,cool:0,inside:false,used:[],
      special:null,specialTriggered:false,boost:null});
  }
  // The Beam lock: the lane is set on the resident the beat names, and the clock holds inside the telegraph so the lane shows.
  function lockLane(lock){
    const s=host.s,boss=host.enemy(),target=s.bodies[lock.target];
    s.warn={def:host.attacks.find(attack=>attack.id===lock.attack),angle:Math.atan2(target.y-boss.y,target.x-boss.x)};
    s.enemyT=lock.seconds;
  }
  function stageBeat(){
    const s=host.s,beat=spec();
    host.cancelHold();
    for(const id of host.ids)place(id,beat.field[id]);
    for(const id of host.ids)s.specialCharge[id]=beat.charge?.[id]??0;
    s.bossAngle=beat.facing; // Bramble's facing, read by the page's baseEnemy(); undefined keeps the page's own
    // Every beat starts from a clean count: no combo carries over, so a weak-spot hit reads exactly x3.
    s.warn=null;s.attackFx=null;s.enemyT=host.RT.firstAttack;regrant=0;s.hits=0;s.hitsIdle=0;
    if(beat.lock)lockLane(beat.lock);
    host.roster();
  }
  // Fresh battle on the page's own reset. Home spots are read after it, so the script never repeats the page's start table.
  function fresh(){
    host.s.bossAngle=undefined;
    internal=true;host.reset();internal=false;
    home=Object.fromEntries(host.ids.map(id=>[id,{x:host.s.bodies[id].x,y:host.s.bodies[id].y}]));
  }

  // ---- The model ----
  function send(event){
    const before=state;
    state=model.next(state,event);
    if(state===before)return;
    timer=0;
    if(state.status!=='running')return finish();
    const caught=before.beat==='dodge'&&before.phase==='try'&&state.phase==='show';
    if(caught)recover=script.recoverSeconds;
    else if(state.phase==='show'&&(before.phase!=='show'||before.beat!==state.beat))stageBeat();
    announce();
  }
  // Done or skipped: remember it, then the ordinary fight starts fresh. It waits for the first sling like any first fight.
  function finish(){
    save(state.status);announce();fresh();
  }
  function begin(event){
    state=model.next(event==='start'?model.INITIAL:state,event);
    timer=recover=0;fresh();stageBeat();announce();
  }

  // ---- What the view gets ----
  function target(aim){
    if(aim.at==='bramble')return host.enemy();
    const s=host.s,actor=s.bodies[aim.actor];
    if(!s.warn)return null; // a caught dodge waits to be staged again: no lane yet, so no demonstration
    const lane=s.warn.angle+script.escapeTurn;
    return {x:actor.x+Math.cos(lane),y:actor.y+Math.sin(lane)};
  }
  // The ghost hand's drag, in arena units: from the resident to the point it is pulled back to.
  function gesture(){
    const beat=spec(),goal=running()&&state.phase==='show'&&beat.aim?target(beat.aim):null;
    if(!goal)return null;
    const actor=host.s.bodies[beat.aim.actor],launch=Math.atan2(goal.y-actor.y,goal.x-actor.x);
    return {id:beat.aim.actor,from:{x:actor.x,y:actor.y},launch,
      to:{x:actor.x-Math.cos(launch)*script.demoPull,y:actor.y-Math.sin(launch)*script.demoPull}};
  }
  // Pixels inside the board, beside the acting resident (the arena's middle when the beat has none).
  function anchor(){
    const s=host.s,id=spec().aim?.actor,body=id&&s.bodies[id],cam=host.camera();
    const at=body?(cam?cam.projection.project({x:body.x,y:body.y}):{x:body.x,y:body.y}):{x:s.w/2,y:s.h/2};
    return {id:id??null,x:at.x*s.scale,y:at.y*s.scale};
  }
  function snapshot(){
    return {state,gesture:gesture(),anchor:running()?anchor():null};
  }
  function announce(){
    if(view&&!predicting())view.onBeat(snapshot());
  }

  // ---- Hooks the page calls ----
  const progress=()=>{timer=0};
  function onGrab(id){
    if(!running()||predicting()||recover>0)return;
    const gate=spec().gate;
    if(gate&&gate!==id)return;
    progress();send('grab');
  }
  function onFling(){
    if(!running()||predicting())return;
    progress();send('launch');
  }
  function onHit(weak){
    if(!running()||predicting())return;
    progress();send({type:'hit',weak:!!weak});
  }
  function onAlly(){
    if(!running()||predicting())return;
    progress();send('ally');
  }
  function onSpecial(){
    if(!running()||predicting())return;
    send('special');
  }
  // A Beam lands: nobody inside means the player escaped. Caught residents are stunned by the page right after this call,
  // so a caught beat is staged again only after recoverSeconds, when the stun has read.
  function onImpact(fx){
    if(!running()||predicting())return;
    send({type:'impact',escaped:!fx.hits.length});
  }

  // Simulation step: hold the enemy clock, keep the shield down, refill a missed special after a rest.
  function step(dt){
    if(!running()||predicting())return;
    const s=host.s,beat=spec(),paced=beat.paced&&state.phase==='try';
    if(!paced)s.enemyT=beat.lock&&state.phase==='show'&&!recover?beat.lock.seconds:host.RT.firstAttack;
    if(s.shield.down<script.shieldHold/2)s.shield.down=script.shieldHold;
    if(state.beat!=='special'||state.phase==='cheer')return;
    const puff=s.bodies.custom;
    if(puff.moving||s.specialCharge.custom>=1){regrant=0;return}
    regrant+=dt;
    if(regrant>=script.regrantDelay){regrant=0;s.specialCharge.custom=1;host.roster()}
  }
  const showSeconds=beat=>beat.show??(beat.paced?0:beat===beats.intro?beat.seconds:script.demoSeconds);
  // Real time: the ghost hand's turn ends, a stalled try shows it again, a cheer ends.
  function tick(real){
    if(!running()||predicting())return;
    if(recover>0){
      if((recover-=real)<=0){recover=0;timer=0;stageBeat();announce()}
      return;
    }
    const beat=spec();
    timer+=real;
    if(state.phase==='show'&&showSeconds(beat)&&timer>=showSeconds(beat))send('idle');
    else if(state.phase==='try'){
      if(host.s.held)timer=0;
      else if(!beat.paced&&timer>=beat.seconds*script.stallShare)send('idle');
    }else if(state.phase==='cheer'&&timer>=(beat.cheer??script.cheerSeconds))send('cheerDone');
  }
  // The page's own reset (Play again, a layout change): Training quits unless this module asked for it. The round-16 tutor and
  // the practice cue rail are retired for good, so no reset leaves their text behind.
  function reset(){
    if(!host)return;
    host.s.tutor=null;host.s.bossAngle=undefined;
    if(!internal&&state.status!=='off'){state=model.next(state,'reset');recover=0;announce()}
  }
  const layout=chosen=>running()?root.LoftRumbleStageLayoutData.options.find(option=>option.id===script.layoutId)??chosen:chosen;

  // The flag: Training exists only on a page opened with ?training. Without it nothing is installed, so the page is the plain fight.
  const enabled=()=>new URLSearchParams(root.location?.search).has(script.flagParam);
  // False only while the flag is on and install() has not run yet, so the page does not treat a not-yet-started Training as absent.
  const settled=()=>!enabled()||!!host;
  function install(options){
    if(!enabled())return;
    host=options;view=options.view;
    view.install?.({skip:()=>send('skip'),replay,closeMenus:options.closeMenus});
    if(read()){reset();announce()}else begin('start');
  }
  // A replay throws away the fight in progress, so the view asks first; a view with no question restarts at once.
  function replay(trigger){
    if(!host)return;
    const restart=()=>{host.closeMenus?.();begin('replay')};
    if(view.confirmReplay)view.confirmReplay(restart,trigger);
    else restart();
  }

  root.LoftRumbleTutorialStage=Object.freeze({install,installed:()=>!!host,settled,state:()=>state,view:()=>view,
    harmless:running,replay,layout,reset,step,tick,onGrab,onFling,onHit,onAlly,onSpecial,onImpact});
})(globalThis);
