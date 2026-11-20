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
  // Contract with the camera session: beforeStep(dt) and afterStep() call in here once per fight step; collideBody calls collide().
  const Swarm=root.LoftRumbleSwarm,Data=root.LoftRumbleEncounterData.swarm,SD=root.LoftRumbleSwarmData;

  const swarmOf=camera=>camera.game.s.swarm;
  const active=camera=>!!swarmOf(camera);
  const state=camera=>swarmOf(camera).model;

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
  function start(camera,{mode,seed}){
    const {s}=camera.game;
    root.LoftRumbleArt?.loadSwarm?.();   // the monster sprites load now, never on a Bramble page; the view skips any not yet loaded
    s.swarm={model:Swarm.create({mode,seed:seed??SD.LAB_SEED,arena:{w:s.w,h:s.h}}),hp0:s.hp};
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
      else if(out.type==='outcome')finish(camera,out.value==='won');
    }
    // The model never tracks the pool: an empty pool is told to it here, and it resolves the loss on its next tick.
    if(s.teamHP<=0&&!state(camera).downed&&state(camera).outcome==='running')send(camera,{type:'teamDown'},false);
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
    send(camera,{type:'tick',dt,heroes:heroes(camera.game)},camera.predicting);
  }

  // One enemy's collision. The page's own damage path runs unchanged (so element and synergy factors and every cue apply) and
  // lowers boss HP; that drop is the hit, sent to the struck monster, and boss HP is put back so it can never win the fight.
  // The boss's own feedback from that path is dropped too (U6): its hit-number popup ("Weak spot" on a weak hit) and the tally
  // that flies into the boss bar. A monster shows its hit through its own bar and puff.
  function collide(camera,target,run){
    const {s}=camera.game;
    if(!active(camera))return run();
    const before=s.hp,popups=s.popups?.length,tally=s.tally,result=run(),dealt=before-s.hp;
    s.hp=before;
    if(popups!==undefined)s.popups.length=popups;
    if(tally===undefined)delete s.tally;else s.tally=tally;
    if(dealt>0&&target.monsterId!==undefined)send(camera,{type:'hit',id:target.monsterId,amount:dealt},camera.predicting);
    return result;
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

  const api=Object.freeze({active,state,start,rearm,sync,beforeStep,afterStep,collide});
  root.LoftRumbleSwarmRuntime=api;
})(typeof globalThis!=='undefined'?globalThis:this);
