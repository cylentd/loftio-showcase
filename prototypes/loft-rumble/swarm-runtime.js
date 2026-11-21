(function(root){
  'use strict';
  // Swarm runtime (ledger #487): joins the pure model (swarm-model.js) to the fight page through the camera session's multi-enemy
  // path (camera-runtime.js enemies / withEnemy / collideBody). It owns no state of its own: the model and a few numbers live in
  // game.s.swarm, so the aim forecast's clone of the fight state clones the swarm too (and its restore puts the real one back).
  //
  // The page gives the camera session `game` these extras (all optional except finishBattle):
  //   finishBattle(won)           the existing finish path; the swarm end screen reads state(camera) from there
  //   swarmFx.hurt(amount,x,y,by) team damage was applied (bar, popup, shake); s.teamHP is already lowered
  //   swarmFx.killed({id,kind,x,y}) a monster was defeated (death puff)
  //   swarmFx.crystalHit({x,y,amount,by,reduced}) defense: a monster bit the crystal (the flash; the shake is done here)
  // Contract with the camera session: beforeStep(dt) and afterStep() call in here once per fight step; collideBody calls collide().
  const Swarm=root.LoftRumbleSwarm,Data=root.LoftRumbleEncounterData.swarm,SD=root.LoftRumbleSwarmData;

  const swarmOf=camera=>camera.game.s.swarm;
  const active=camera=>!!swarmOf(camera);
  const state=camera=>swarmOf(camera).model;
  // Hero-contact feel (a teammate touch's hit-stop, two heroes bumping's shake): calm in a swarm, where heroes touch all the time
  // and each freeze read as lag (owner 2026-11-20); the page's value everywhere else.
  const calm=(camera,value)=>camera&&active(camera)?0:value;

  // The page's heroes as the model sees them: a position and a radius.
  const heroes=({s,C,ids})=>ids.map(id=>({x:s.bodies[id].x,y:s.bodies[id].y,r:C.radius}));

  // Rebuild the camera scene's enemy list from the monsters that can be hit (alive). An enemy object is kept between syncs, so its
  // guard plate and the per-enemy contact memory (scene.inside) survive; the list itself is replaced, never edited, so a
  // collideBody loop in progress finishes over the list it started with.
  function sync(camera){
    const scene=camera.game.s.cameraScene,kept=new Map(scene.enemies.map(e=>[e.id,e]));
    scene.enemies=state(camera).monsters.filter(m=>m.life==='alive').map(m=>{
      const id='monster-'+m.id,e=kept.get(id)??{id,type:'monster',angle:Data.weakAngle,
        shield:{angle:Data.weakAngle,hp:0,cracks:0,down:SD.HELD_S,up:0,seen:true}};
      return Object.assign(e,{kind:m.kind,monsterId:m.id,x:m.x,y:m.y,baseX:m.x,baseY:m.y,radius:m.r});
    });
  }

  // Put a swarm into the fight and restart it. The fight's reset() reaches rearm() through camera.resetScene().
  // teamMax is the configured pool (the page's RT.teamHP, which its TURN.hp and team bar text use), never the current s.teamHP:
  // a start after damage would otherwise shrink the bar's scale (D5).
  function start(camera,{mode,seed,bench}){
    const {s,RT}=camera.game;
    root.LoftRumbleArt?.loadSwarm?.();   // swarm-only art, never on a Bramble page; none since 2026-11-20 (monsters and bar are code-drawn, puff and seed are in `assets`)
    s.swarm={model:Swarm.create({mode,seed:seed??SD.LAB_SEED,arena:{w:s.w,h:s.h},bench}),hp0:s.hp,teamMax:RT.teamHP};
    camera.game.reset();
  }

  // Called by camera.resetScene() after it has made a fresh scene: a swarm in the fight restarts with its own seed.
  function rearm(camera){
    const {s}=camera.game;
    if(!s.swarm)return;
    s.swarm.model=Swarm.next(s.swarm.model,{type:'reset'}).state;
    Object.assign(s.cameraScene,{name:'SWARM',swarm:true,enemies:[]});
  }

  function finish(camera,won){
    camera.game.finishBattle(won);
  }

  // Apply what the model reported. The forecast never calls this: it runs on a clone and its outs are dropped.
  function apply(camera,outs){
    const {game}=camera,{s}=game,fx=game.swarmFx;
    for(const out of outs){
      if(out.type==='teamDamage'){
        s.teamHP=Math.max(0,s.teamHP-out.amount);
        fx?.hurt(out.amount,out.x,out.y,out.by);
      }else if(out.type==='killed')fx?.killed(out);
      else if(out.type==='crystalHit')crystalHit(camera,out);
      else if(out.type==='outcome')finish(camera,out.value==='won');
    }
    if(state(camera).mode==='defense'){mirrorHp(camera);return}   // the model owns hp here: no teamDown, it resolves the loss itself
    // The model never tracks the pool: an empty pool is told to it here, and it resolves the loss on its next tick.
    if(s.teamHP<=0&&!state(camera).downed&&state(camera).outcome==='running')send(camera,{type:'teamDown'},false);
  }

  // Defense: the page's team bar shows the crystal's hp as a share of the pool the page started with.
  function mirrorHp(camera){
    const {s}=camera.game,sw=s.swarm,crystal=state(camera).crystal;
    s.teamHP=Math.ceil(sw.teamMax*Math.max(0,crystal.hp)/crystal.maxHP);   // whole points, up: a living crystal never reads 0
  }

  // Defense: a monster bit the crystal. A light shake unless motion is reduced; the view draws the flash.
  function crystalHit(camera,out){
    const {game}=camera,{s}=game,reduced=!!game.still?.();
    if(!reduced)s.shake=Math.max(s.shake??0,game.FEEL.shakeAttack*Data.defense.shakeShare);
    mirrorHp(camera);   // before the fx and any outcome in the same batch: a loss ends the frame loop, so the bar must already read the new hp
    game.swarmFx?.crystalHit({x:out.x,y:out.y,amount:out.amount,by:out.by,reduced});
  }

  // Defense: the residents stand in a row at the hero row. The page calls this after it has built the fight's bodies.
  function place(camera){
    const {s,ids}=camera.game;
    if(!active(camera)||state(camera).mode!=='defense')return;
    ids.forEach((id,i)=>Object.assign(s.bodies[id],{x:s.w*(i+1)/(ids.length+1),y:s.h*Data.defense.heroRow}));
    // The crystal's bumper is as wide as the crystal (a share of the arena width). This overwrites the page's shared FEEL.bumperRadius
    // on purpose and never restores it: the swarm stage comes only from ?stage= at boot (rumble-encounters.js stageMode, one
    // SwarmRuntime.start), the encounter control is locked while a swarm runs, so no non-defense fight ever follows on this page load.
    camera.game.FEEL.bumperRadius=Data.defense.bumperRadius*s.w;
    mirrorHp(camera);
  }

  function send(camera,event,forecast){
    const sw=swarmOf(camera),result=Swarm.next(sw.model,event);
    sw.model=result.state;
    if(!forecast)apply(camera,result.out);
    sync(camera);
  }

  function beforeStep(camera,dt){
    const {s}=camera.game;
    if(!active(camera)||s.phase!=='play')return;
    s.enemyT=SD.HELD_S; // the boss is absent: its clock never reaches an attack
    s.swarm.hp0=s.hp;        // what boss HP must be again after this step (see collide, afterStep)
    // The fight steps at 180 Hz; the model ticks at most every TICK_S (FORECAST_TICK_S in the aim forecast) with the time banked
    // since its last tick. The bank lives in s.swarm, so the forecast's clone banks on its own copy.
    const every=camera.predicting?SD.FORECAST_TICK_S:SD.TICK_S;
    s.swarm.bank=(s.swarm.bank??0)+dt;
    if(s.swarm.bank<every)return;
    const banked=s.swarm.bank;
    s.swarm.bank=0;
    send(camera,{type:'tick',dt:banked,heroes:heroes(camera.game)},camera.predicting);
    if(!camera.predicting&&state(camera).mode==='defense')mirrorHp(camera); // a heal or other page change to the pool does not stick: the model owns hp
  }

  // One enemy's collision. The page's own damage path runs unchanged (so element and synergy factors and every cue apply) and
  // lowers boss HP; that drop is the hit, sent to the struck monster, and boss HP is put back so it can never win the fight.
  // The boss's own feedback from that path is dropped too (U6): its hit-number popup ("Weak spot" on a weak hit) and the tally
  // that flies into the boss bar. A monster shows its hit through its own bar and puff.
  // A killing hit plows through (owner 2026-11-20: monsters die fast, so a fling that bounced off each kill made every kill another
  // flick): the page's reflection and bounce cost are undone, and the hero gets KILL_REFUND of its budget back, capped at full.
  // A hit that leaves the monster standing bounces as before. The forecast takes the same path, so the aim line shows it.
  function collide(camera,target,run,body){
    const {s}=camera.game;
    if(!active(camera))return run();
    const flight=body&&{x:body.x,y:body.y,vx:body.vx,vy:body.vy,left:body.glide?.left};
    const before=s.hp,popups=s.popups?.length,tally=s.tally,stop=s.hitStop,shake=s.shake,result=run(),dealt=before-s.hp;
    s.hp=before;
    // The page's boss hit-stop and shake are dropped too (owner 2026-11-20): re-armed on every monster a fling plows through, they
    // froze and shook the fight many times a second, which read as lag. A kill keeps its spark burst (swarmFx.killed).
    s.hitStop=stop??0;s.shake=shake??0;
    if(popups!==undefined)s.popups.length=popups;
    if(tally===undefined)delete s.tally;else s.tally=tally;
    if(!(dealt>0)||target.monsterId===undefined)return result;
    // The hero as it flew into the hit (before the page's reflection): the model pushes the monster along that flight (recoil).
    const from=flight&&{x:flight.x,y:flight.y,vx:flight.vx,vy:flight.vy};
    send(camera,{type:'hit',id:target.monsterId,amount:dealt,from},camera.predicting);
    const struck=state(camera).monsters.find(m=>m.id===target.monsterId);
    if(flight&&struck&&struck.life!=='alive')plowOn(body,flight);
    return result;
  }
  function plowOn(body,{x,y,vx,vy,left}){
    Object.assign(body,{x,y,vx,vy});
    const g=body.glide;
    if(g&&left!==undefined)g.left=Math.min(g.budget,left+g.budget*SD.KILL_REFUND);
  }

  // Damage from anything that is not a fling hit (abilities, fields, bolts) also lands on boss HP in the page. It goes to the first
  // live monster and boss HP is put back. A known approximation: those sources aim at the page's one enemy().
  function afterStep(camera){
    const {s}=camera.game;
    if(!active(camera)||s.phase!=='play')return;
    const dealt=s.swarm.hp0-s.hp,first=s.cameraScene.enemies[0];
    if(!(dealt>0))return;
    s.hp=s.swarm.hp0;
    if(first)send(camera,{type:'hit',id:first.monsterId,amount:dealt},false);
  }

  const api=Object.freeze({active,state,calm,start,rearm,place,sync,beforeStep,afterStep,collide});
  root.LoftRumbleSwarmRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this);
