// Tap-to-fire specials engine: pure functions, no page, no clock (#536). Numbers live in special-data.js.
// Lifecycle per hero: charging -> ready -> cutin (first special of a battle only) -> active -> charging
// (docs/architecture/STATE-MACHINES.md, "Rule for new work": one state type, one pure next(state, event)).
(function(root){
  const D=root.LoftRumbleSpecialData; // special-data.js loads first, as the other rumble data files do
  const FULL=1; // charge is a fraction; 1 is a full bar
  const MODE_FALLBACK='boss'; // a mode with no numbers reads boss

  function specialFor(id,trait){
    const own=Object.prototype.hasOwnProperty;
    if(typeof id==='string'&&own.call(D.specials,id))return D.specials[id];
    const byTrait=typeof trait==='string'&&own.call(D.defaultByTrait,trait)?D.defaultByTrait[trait]:D.fallbackSpecial;
    return D.specials[byTrait];
  }
  const isTap=(moved,heldS)=>moved<D.tap.maxMovePx&&heldS<=D.tap.maxHoldS;

  // A buff is {bucket, mult}. Max inside a bucket, product across buckets.
  function bucketMultiplier(buffs){
    const best={};
    for(const buff of buffs)best[buff.bucket]=Math.max(best[buff.bucket]??buff.mult,buff.mult);
    return Object.values(best).reduce((product,mult)=>product*mult,1);
  }

  // A hero's special state. `duration` is how long active lasts; `remaining` counts down while active.
  const start=(id,mode,trait)=>Object.freeze({phase:'charging',charge:0,cutinSeen:false,special:specialFor(id,trait).id,
    duration:specialFor(id,trait).duration,remaining:0,mode:mode||MODE_FALLBACK});
  const set=(state,patch)=>Object.freeze({...state,...patch});
  function fire(state,event){
    if(state.phase!=='ready'||event.moving||event.stunned)return state;
    const spent={charge:0,cutinSeen:true};
    return state.cutinSeen?set(state,{...spent,phase:'active',remaining:state.duration}):set(state,{...spent,phase:'cutin'});
  }
  // Charge may build in any phase; only a charging hero that fills becomes ready. Active keeps the bar until it ends.
  function charge(state,event){
    const filled=Math.min(FULL,state.charge+event.amount);
    return set(state,{charge:filled,phase:state.phase==='charging'&&filled>=FULL?'ready':state.phase});
  }
  function tick(state,event){
    if(state.phase!=='active')return state;
    const left=state.remaining-event.dt;
    if(left>0)return set(state,{remaining:left});
    return set(state,{remaining:0,phase:state.charge>=FULL?'ready':'charging'}); // a bar filled during the special is ready at once
  }
  const HANDLERS={
    charge,tap:fire,auto:fire,tick,
    cutinDone:state=>state.phase==='cutin'?set(state,{phase:'active',remaining:state.duration}):state,
    reset:state=>set(state,{phase:'charging',charge:0,cutinSeen:false,remaining:0})
  };
  function next(state,event){
    const handler=Object.prototype.hasOwnProperty.call(HANDLERS,event.type)?HANDLERS[event.type]:null;
    if(!handler)throw new Error('unknown special event: '+event.type);
    return handler(state,event);
  }

  // Meteor. Enemies are {x,y,hp}; the functions read them and never move one.
  const live=enemy=>enemy.hp>0;
  const gap=(from,enemy)=>Math.hypot(enemy.x-from.x,enemy.y-from.y);
  function meteorTarget(from,enemies){
    let best=null;
    for(const enemy of enemies.filter(live))if(best===null||gap(from,enemy)<gap(from,best))best=enemy;
    return best;
  }
  function meteorHits(center,enemies,mode){
    const numbers=D.specials.meteor[mode]||D.specials.meteor[MODE_FALLBACK];
    return enemies.filter(live).filter(enemy=>gap(center,enemy)<=numbers.radius).map(enemy=>({enemy,damage:numbers.damage}));
  }

  // On-field effects (U2b). One per tapped special: {kind, x, y, age, life, landed, justLanded}. x,y is where it happens: the caster
  // for Picnic and Big Plush, the boss for Meteor. The page ages them in step(), the draw layer reads `at`.
  const clamp01=value=>Math.min(1,Math.max(0,value));
  // The spot may also name the caster (`id`), where it leaps from (`from`) and the burst width (`radius`); Meteor's draw reads them.
  function fxStart(kind,spot){
    if(!Object.prototype.hasOwnProperty.call(D.fx,kind)||kind==='stillAt')return null;
    const fx={kind,x:spot.x,y:spot.y,age:0,life:D.fx[kind].life,landed:false,justLanded:false};
    for(const key of ['id','from','radius'])if(spot[key]!==undefined)fx[key]=spot[key];
    return fx;
  }
  // Where a Meteor lands and how wide it bursts: the live enemy nearest the caster, and the burst width of the mode (boss or swarm).
  function meteorSpot(from,enemies,mode){
    const target=meteorTarget(from,enemies);
    if(!target)return null;
    return {x:target.x,y:target.y,radius:(D.specials.meteor[mode]||D.specials.meteor[MODE_FALLBACK]).radius};
  }
  // Meteor lands when its fall ends; `landed` stays true after, `justLanded` is true on the one step that crossed it.
  function fxStep(list,dt){
    return list.map(e=>({...e,age:e.age+dt})).filter(e=>e.age<e.life).map(e=>{
      const down=e.kind==='meteor'&&e.age>=D.fx.meteor.fallS;
      return {...e,landed:down,justLanded:down&&!e.landed};
    });
  }
  // Progress: t over the whole life; Meteor also fall (0 to 1) then impact (0 to 1).
  function fxAt(e){
    const t=clamp01(e.age/e.life);
    if(e.kind!=='meteor')return {t,fall:1,impact:t};
    const fall=D.fx.meteor.fallS;
    return {t,fall:clamp01(e.age/fall),impact:clamp01((e.age-fall)/(e.life-fall))};
  }

  // The Tap / Auto setting, same shape as LoftRumbleDragFeedback.throwStyle. Storage is injected; a throwing store reads tap.
  const S=D.setting;
  const valid=value=>S.modes.includes(value)?value:S.fallback;
  function createSetting({storage=null,onChange=()=>{}}={}){
    let value=S.fallback;
    try{value=valid(storage?.getItem(S.storageKey))}catch{}
    function set(next){
      const chosen=valid(next);
      try{storage?.setItem(S.storageKey,chosen)}catch{}
      if(chosen!==value){value=chosen;onChange(chosen)}
      return chosen;
    }
    return Object.freeze({get:()=>value,set});
  }
  const model=Object.freeze({specialFor,isTap,bucketMultiplier,start,next,meteorTarget,meteorHits,meteorSpot,fx:Object.freeze({start:fxStart,step:fxStep,at:fxAt}),setting:Object.freeze({create:createSetting,valid})});
  root.LoftRumbleSpecials=model;
})(typeof globalThis!=='undefined'?globalThis:this);
