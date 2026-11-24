(function(root){
  'use strict';
  // Swarm model (ledger #487). Pure: next(state, event) -> {state, out[]}. The state is plain JSON (it can be cloned and saved), its
  // dice are a seeded generator held in state.rng, and next never changes the state it is given. A refused event returns that same
  // state and no out. All numbers come from swarm-data.js; in hunt and hold the runtime owns the team HP pool and sends teamDown
  // when it empties. In defense the model owns the crystal (state.crystal {x,y,r,hp,maxHP}, arena units): monsters march on it, bite it and emit
  // crystalHit, it resolves 'lost' itself at crystal hp 0, and the page never sends teamDown.
  //
  // Events (all carry `type`): tick {dt, heroes:[{x,y,r}]}, hit {id, amount, from?:{x,y,vx,vy}} (from: the hero, for recoil),
  // teamDown, reset. A monster may carry kvx, kvy (its recoil velocity) and stagger (seconds its own movement waits).
  // Out (all carry `type`): teamDamage {amount, x, y, by}, crystalHit {amount, x, y, by} (defense), killed {id, kind, x, y}, outcome {value}.
  // teamDown latches state.downed and resolves to 'lost' on the next tick, so a final kill sent in the same frame still wins,
  // in either order. The runtime must keep ticking until it sees an outcome.
  const D=root.LoftRumbleSwarmData;

  // mulberry32 (the generator the study bots use): increment, mixing shifts, multiplier offset, and 2^32 to scale to [0, 1).
  const RNG_INC=0x6D2B79F5,RNG_SHIFT_A=15,RNG_SHIFT_B=7,RNG_MIX=61,RNG_SHIFT_C=14,UINT32=4294967296;
  const rand=s=>{
    s.rng=s.rng+RNG_INC|0;
    let t=Math.imul(s.rng^s.rng>>>RNG_SHIFT_A,1|s.rng);
    t=t+Math.imul(t^t>>>RNG_SHIFT_B,RNG_MIX|t)^t;
    return((t^t>>>RNG_SHIFT_C)>>>0)/UINT32;
  };

  // A copy one level deep per nested part: the state's arrays hold flat objects. The JSON round trip it replaced cost 68 ms per aim
  // forecast (720 ticks, 18 monsters; 2026-11-20), the swarm's frame drops while aiming.
  const clone=s=>{
    const c={...s,arena:{...s.arena},monsters:s.monsters.map(m=>({...m})),shots:s.shots.map(sh=>({...sh}))};
    if(s.queue)c.queue=s.queue.slice();
    if(s.crystal)c.crystal={...s.crystal};
    if(s.bench)c.bench={...s.bench};
    if(s.combo)c.combo={...s.combo};   // counter, picks and offer are replaced whole by their pure modules, never edited in place
    return c;
  };

  // Combo counter and picks (ledger #518 U2), opt-in with create({combo:true}). The modules load first (combo-counter.js, rumble-picks.js).
  const Counter=()=>root.LoftRumbleCounter,Picks=()=>root.LoftRumblePicks;
  const comboOn=s=>!!s.combo;
  const scaled=e=>Object.fromEntries(Object.entries(e).map(([id,v])=>[id,v*(D.PICK_SCALE[id]??1)]));   // per-card swarm scaling (swarm-data.js PICK_SCALE)
  const fx=s=>(s.picks?scaled(Picks().effects(s.picks)):{});
  const STUN_FLOOR_S=0;   // Steady never makes a stun negative
  const refuse=state=>({state,out:[]});
  const num=v=>typeof v==='number'&&Number.isFinite(v);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const isLive=m=>m.life==='spawning'||m.life==='alive';

  const newMonster=(s,kind,x,y,life)=>{   // a defense monster remembers the wave it entered in (progress().held)
    const k=D.KINDS[kind];
    const m={id:s.nextId++,kind,x,y,r:k.r,hp:k.hp,maxHP:k.hp,life,age:0,facing:1,cd:0,timer:0,spitIn:k.spitEvery||0};
    if(s.mode==='defense')m.wave=s.wave;
    s.monsters.push(m);
  };

  // Defense: a wave's queue is its monsters of each kind, shuffled by the seeded dice (Fisher-Yates), so one seed is one run.
  const startWave=s=>{
    const counts=D.DEFENSE_WAVES[s.wave-1],q=[];
    for(const id of D.IDS)for(let i=0;i<counts[id];i++)q.push(id);
    for(let i=q.length-1;i>0;i--){const j=Math.floor(rand(s)*(i+1)),t=q[i];q[i]=q[j];q[j]=t;}
    s.queue=q;   // entryIn carries over, so the next wave enters one entry gap after the last one of the wave before
  };

  const create=({mode,seed,arena,bench,combo}={})=>{
    const m=D.MODES[mode];
    if(!m)throw new Error('swarm: unknown mode '+String(mode));
    const a=arena||D.ARENA;
    const s={mode,goal:m.goal,t:0,kills:0,rng:seed|0,seed:seed|0,arena:{w:a.w,h:a.h},spawnIn:D.FIRST_SPAWN_S,nextId:1,
      monsters:[],shots:[],downed:false,outcome:'running'};
    if(mode==='defense'){
      const c=D.CRYSTAL;   // shares of the arena become arena units here, once
      Object.assign(s,{crystal:{x:c.x*s.arena.w,y:c.y*s.arena.h,r:c.r*s.arena.w,hp:c.hp,maxHP:c.hp},bites:0,wave:1,lull:0,queue:[],entryIn:0});startWave(s);
    }
    if(mode==='bench'){   // frame-rate bench (swarm-bench.js): n monsters on the field from the first tick
      const B=root.LoftRumbleSwarmBench;
      s.bench={n:B.clampN(bench&&bench.n)};
      for(const p of B.layout(s.bench.n,s.arena))newMonster(s,p.kind,p.x,p.y,'alive');
    }
    if(combo){
      if(!Counter()||!Picks())throw new Error('swarm: load combo-counter.js and rumble-picks.js first');
      // combo: true runs the counter and the picks; {picks:false} runs the counter alone (the study's no-pick arm).
      Object.assign(s,{combo:{count:0,idle:0,peak:0},counter:Counter().create('swarm'),picks:Picks().create(),offer:null,heldSeen:0,heroes:[],noPicks:combo.picks===false});
    }
    return s;
  };

  // Waves held: all of them on a win; else an earlier wave with no live monster of its own, plus the current wave once its queue
  // is empty and none of its monsters lives. The wave counter alone moves on while the last wave still bites.
  const wavesHeld=s=>{
    const total=D.DEFENSE_WAVES.length;
    if(s.outcome==='won')return total;
    let held=0;
    for(let w=1;w<=Math.min(s.wave,total);w++){
      if(w===s.wave&&s.queue.length)break;
      if(s.monsters.some(m=>m.wave===w&&isLive(m)))continue;
      held++;
    }
    return held;
  };

  const progress=s=>{
    if(s.mode==='defense')return{mode:s.mode,kills:s.kills,wave:s.wave,waves:D.DEFENSE_WAVES.length,lullLeft:Math.max(0,s.lull),hp:s.crystal.hp,bites:s.bites,held:wavesHeld(s)};
    const done=s.mode==='hunt'?s.kills:s.t;
    return{mode:s.mode,kills:s.kills,goal:s.goal,t:s.t,remaining:Math.max(0,s.goal-done),frac:Math.min(1,Math.max(0,done/s.goal))};
  };

  const finish=(s,out,value)=>{s.outcome=value;out.push({type:'outcome',value});return{state:s,out};};

  // Recoil: a hit carrying the hero `from` {x, y, vx, vy} pushes a surviving monster along the hero's flight, or away from where the
  // hero stands when it is nearly still (KNOCK.STILL_SPEED), and staggers it. The push is a velocity (kvx, kvy) that knock() spends
  // over the next ticks; a hit with no hero (fields, abilities) neither pushes nor staggers.
  const recoil=(m,from,scale=1)=>{
    if(!from||![from.x,from.y,from.vx,from.vy].every(num))return;
    const K=D.KNOCK,speed=Math.hypot(from.vx,from.vy);
    let ux=from.vx,uy=from.vy,len=speed;
    if(speed<K.STILL_SPEED){ux=m.x-from.x;uy=m.y-from.y;len=Math.hypot(ux,uy);}
    m.stagger=K.STAGGER_S[m.kind];
    if(!(len>0))return;
    const v=K.DIST[m.kind]*scale/K.DECAY_S;   // a push decaying by e every DECAY_S covers v x DECAY_S in all
    m.kvx=ux/len*v;m.kvy=uy/len*v;
  };
  // Spend a push over dt (exact for the exponential decay, so the tick rate does not change the distance), keep the monster in the
  // arena, and count the stagger down. True while staggered: the monster's own march or chase waits.
  const knock=(s,m,dt)=>{
    if(m.kvx||m.kvy){
      const K=D.KNOCK,f=Math.exp(-dt/K.DECAY_S),travel=K.DECAY_S*(1-f);
      m.x+=m.kvx*travel;m.y+=m.kvy*travel;m.kvx*=f;m.kvy*=f;
      if(Math.hypot(m.kvx,m.kvy)<K.STOP_SPEED){m.kvx=0;m.kvy=0;}
      keepIn(s,m);
    }
    if(!(m.stagger>0))return false;
    m.stagger=Math.max(0,m.stagger-dt);
    return true;
  };

  // --- Combo counter (combo-counter.js) in the swarm. One step of the pure counter, then what the swarm does about the phase it reached.
  // A telegraph spawns the elite and reports the ring; every ending reports itself (counter out), a landed one zeroes the combo, and an
  // elite still on the field leaves with it. The runtime shows the result in the same frame, so the counter settles to idle at once.
  const spawnElite=s=>{
    const k=D.KINDS[D.ELITE.KIND],e=D.EDGE[D.ELITE.KIND],hp=Math.round(k.hp*root.LoftRumbleCounterData.ELITE_HP_SCALE);
    s.monsters.push({id:s.nextId++,kind:D.ELITE.KIND,x:e+rand(s)*(s.arena.w-2*e),y:D.TOP_INSET[D.ELITE.KIND],r:k.r,hp,maxHP:hp,
      life:'spawning',age:0,facing:1,cd:0,timer:0,spitIn:k.spitEvery||0,elite:true});
  };
  const counterStep=(s,event,out)=>{
    const before=s.counter,after=Counter().step(before,event);
    if(after===before)return;
    s.counter=after;
    if(after.phase==='telegraph'){
      if(before.phase!=='idle')return;   // a tick of the running telegraph, not a start
      spawnElite(s);
      out.push({type:'counter',phase:'telegraph',x:after.zone?after.zone.x:null,y:after.zone?after.zone.y:null,r:root.LoftRumbleCounterData.COUNTER_R,hero:after.target});
      return;
    }
    if(!root.LoftRumbleCounterData.RESOLVED.includes(after.phase))return;
    const landed=after.phase==='landed',stunS=landed?Math.max(STUN_FLOOR_S,after.result.stunS+(fx(s).steady||0)):0;
    out.push({type:'counter',phase:after.phase,stun:landed?after.result.stun:[],stunS});
    if(landed){s.combo.count=after.result.combo;s.combo.idle=0;}
    for(const m of s.monsters)if(m.elite&&isLive(m)){m.life='dying';m.timer=0;}   // the elite leaves with its counter (a killed one is already dying)
    s.counter=Counter().step(s.counter,{type:'settle'});
  };

  // A landed hit: one more on the combo (or the page's own count when the hit carries it), the peak for the next pick, and a counter
  // event. The ring goes where the hero who made the hit stands (the last tick's heroes), else where its flight began.
  const comboHit=(s,ev,out)=>{
    const c=s.combo,count=num(ev.combo)?ev.combo:c.count+1,hero=Number.isInteger(ev.hero)?ev.hero:null,at=hero!==null&&s.heroes[hero]||ev.from;
    c.count=count;c.idle=0;s.picks=Picks().trackPeak(s.picks,count);
    counterStep(s,{type:'combo',combo:count,hero,zone:at&&num(at.x)&&num(at.y)?{x:at.x,y:at.y}:null},out);
  };

  const onHit=(state,ev)=>{
    if(state.outcome!=='running'||!num(ev.amount)||ev.amount<=0||state.offer)return refuse(state);
    const idx=state.monsters.findIndex(m=>m.id===ev.id&&m.life==='alive');
    if(idx<0)return refuse(state);
    const s=clone(state),m=s.monsters[idx],out=[],e=fx(s);
    m.hp=Math.max(0,m.hp-ev.amount*(1+(e.punch||0)));
    if(m.hp>0){recoil(m,ev.from,1+(e.shove||0));}
    else{
      m.life='dying';m.timer=0;s.kills++;
      out.push({type:'killed',id:m.id,kind:m.kind,x:m.x,y:m.y});
      if(comboOn(s)&&m.elite)counterStep(s,{type:'eliteKilled'},out);
      if(s.mode==='hunt'&&s.kills>=s.goal)finish(s,out,'won');
    }
    if(comboOn(s))comboHit(s,ev,out);
    return{state:s,out};
  };

  // Picks: Defense opens an offer each time wavesHeld rises, for waves 1 to PICKS.MODES.defense.picks. The fight is paused while it is open.
  const checkOffer=(s,out)=>{
    const held=wavesHeld(s);
    if(s.noPicks||held<=s.heldSeen)return;
    s.heldSeen=held;
    if(held>Picks().picksFor('defense'))return;
    const cards=Picks().offer({state:s.picks,mode:'defense',rng:()=>rand(s)});
    if(!cards.length)return;
    s.offer={cards,wave:held};
    out.push({type:'offer',cards});
  };
  const onPick=(state,ev)=>{
    const card=state.offer&&state.offer.cards[ev.index];
    if(!card)return refuse(state);
    const picks=Picks().choose(state.picks,card);
    if(picks===state.picks)return refuse(state);
    const s=clone(state);s.picks=picks;s.offer=null;
    if(card.id==='mend'&&s.crystal){s.crystal.hp+=card.value;s.crystal.maxHP+=card.value;}   // team HP: the crystal's pool grows
    return{state:s,out:[{type:'picked',id:card.id,size:card.size,value:card.value}]};
  };

  const onTeamDown=state=>{
    if(state.outcome!=='running'||state.downed)return refuse(state);
    const s=clone(state);s.downed=true;
    return{state:s,out:[]};
  };

  const onReset=state=>({state:create({mode:state.mode,seed:state.seed,arena:state.arena,bench:state.bench,combo:comboOn(state)&&{picks:!state.noPicks}}),out:[]});

  const nearest=(m,heroes)=>heroes.reduce((best,h)=>(!best||dist(m,h)<dist(m,best)?h:best),null);

  // Move a monster dx,dy toward (sign 1) or away from (sign -1) a point, at most `step` units.
  const move=(m,to,sign,step)=>{
    const d=dist(m,to);
    if(d===0)return;
    m.x+=sign*(to.x-m.x)/d*step;m.y+=sign*(to.y-m.y)/d*step;
  };

  const startSpit=(s,m,target)=>{
    const d=dist(m,target)||1;
    s.shots.push({id:s.nextId++,x:m.x,y:m.y,vx:(target.x-m.x)/d*D.SHOT_SPEED,vy:(target.y-m.y)/d*D.SHOT_SPEED,
      r:D.SHOT_R,phase:'telegraph',t:0,by:m.kind});
    m.spitIn=D.KINDS[m.kind].spitEvery;
  };

  const stepAlive=(s,m,dt,heroes,out)=>{
    const k=D.KINDS[m.kind],h=nearest(m,heroes);
    m.cd=Math.max(0,m.cd-dt);
    if(!h)return;
    const d=dist(m,h);
    if(h.x!==m.x)m.facing=h.x>m.x?1:-1;
    if(k.spitEvery){
      if(d>k.keepMax)move(m,h,1,k.speed*dt);else if(d<k.keepMin)move(m,h,-1,k.speed*dt);
      m.spitIn-=dt;
      if(m.spitIn<=0)startSpit(s,m,h);
    }else if(d>m.r+h.r)move(m,h,1,Math.min(k.speed*dt,d-m.r-h.r));
    if(dist(m,h)<=m.r+h.r&&m.cd===0){
      m.cd=k.contactCd;
      out.push({type:'teamDamage',amount:k.contact,x:m.x,y:m.y,by:m.kind});
    }
  };

  // Defense: walk toward the crystal centre and stop at the monster's r + the crystal's r (less REACH_SLACK, so float error never voids
  // the bite), then bite once per CRYSTAL_BITE_CD_S. A biter is alive and touching the crystal: it has no life state of its own.
  const biteCrystal=(s,m,out)=>{
    if(m.cd>0||dist(m,s.crystal)>m.r+s.crystal.r)return;
    const amount=D.CRYSTAL_BITE[m.kind];
    m.cd=D.CRYSTAL_BITE_CD_S;
    s.crystal.hp=Math.max(0,s.crystal.hp-amount);s.bites++;
    out.push({type:'crystalHit',amount,x:m.x,y:m.y,by:m.kind});
  };
  const marchAndBite=(s,m,dt,out)=>{
    const c=s.crystal,stop=m.r+c.r-D.REACH_SLACK,d=dist(m,c);
    m.cd=Math.max(0,m.cd-dt);
    if(d>stop)move(m,c,1,Math.min(D.DEFENSE_MARCH[m.kind]*dt,d-stop));
    biteCrystal(s,m,out);
  };

  const stepMonster=(s,m,dt,heroes,out)=>{
    m.age+=dt;
    if(m.life==='spawning'){if(m.age>=D.SPAWN_RUNE_S)m.life='alive';}
    else if(m.life==='dying'){m.timer+=dt;if(m.timer>=D.DYING_S)m.life='removed';}
    else if(m.life==='alive'){
      if(knock(s,m,dt))return;   // staggered by a hit: no march, chase, bite or spit this tick
      if(s.mode==='defense'){marchAndBite(s,m,dt,out);return;} // defense monsters march on the crystal and bite it; none bites a hero or spits
      if(s.mode==='bench'){Object.assign(m,root.LoftRumbleSwarmBench.march(m,dt,s.arena));return;} // bench monsters march; none bites or spits
      stepAlive(s,m,dt,heroes,out);
    }
  };

  // Bench: a defeated monster is replaced at the top, of the kind the field has least of, so the count and the mix hold.
  const refill=s=>{
    const B=root.LoftRumbleSwarmBench,live=s.monsters.filter(isLive).map(m=>m.kind);
    while(live.length<s.bench.n){
      const kind=B.kindToAdd(live),e=D.EDGE[kind];
      newMonster(s,kind,e+rand(s)*(s.arena.w-2*e),D.TOP_INSET[kind],'alive');
      live.push(kind);
    }
  };

  const stepShot=(s,sh,dt,heroes,out)=>{
    sh.t+=dt;
    if(sh.phase==='telegraph'){if(sh.t>=D.TELEGRAPH_S){sh.phase='flying';sh.t=0;}return true;}
    sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;
    const h=heroes.find(o=>dist(sh,o)<=sh.r+o.r);
    if(h){out.push({type:'teamDamage',amount:D.SHOT_DAMAGE,x:sh.x,y:sh.y,by:sh.by});return false;}
    const pad=sh.r;
    return sh.x>=-pad&&sh.x<=s.arena.w+pad&&sh.y>=-pad&&sh.y<=s.arena.h+pad;
  };

  // Spacing: live and spawning monsters closer than the sum of their kinds' SPACE are pushed apart, half the overlap each, over
  // SPACING_PASSES passes, then kept inside the arena. Two on one spot split along x (no dice, so a run still replays).
  const HALF=.5;
  // keepIn holds a monster EDGE in from the sides and TOP_INSET down from the top (its drawn body and bar stay on screen) and
  // r up from the bottom. clearHeroes moves it out to a hero's reach (the radii's sum, less REACH_SLACK) if the crowd shoved it
  // inside, so a biting monster stands at the resident's edge, never on its face. keepIn runs after it, so the edge always wins:
  // a monster pinned between a hero and a wall stays on screen (and inside that hero's reach, where it bites).
  const keepIn=(s,m)=>{const e=D.EDGE[m.kind];m.x=Math.min(s.arena.w-e,Math.max(e,m.x));m.y=Math.min(s.arena.h-m.r,Math.max(D.TOP_INSET[m.kind],m.y));};
  const clearHeroes=(m,heroes)=>{for(const h of heroes){
    const reach=m.r+h.r-D.REACH_SLACK,d=dist(m,h);
    if(d>=reach)continue;
    const ux=d>0?(m.x-h.x)/d:0,uy=d>0?(m.y-h.y)/d:-1;
    m.x=h.x+ux*reach;m.y=h.y+uy*reach;
  }};
  // Defense: a monster the crowd shoved into the crystal is moved back out to its edge. Runs after the spacing push, before keepIn.
  const clearCrystal=(m,c)=>{
    const reach=m.r+c.r-D.REACH_SLACK,d=dist(m,c);
    if(d>=reach)return;
    const ux=d>0?(m.x-c.x)/d:0,uy=d>0?(m.y-c.y)/d:-1;
    m.x=c.x+ux*reach;m.y=c.y+uy*reach;
  };
  const space=(s,heroes)=>{
    const live=s.monsters.filter(isLive);
    for(let pass=0;pass<D.SPACING_PASSES;pass++){
      for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
        const a=live[i],b=live[j];
        if(s.mode==='defense'&&D.DEFENSE_FLIERS.includes(a.kind)!==D.DEFENSE_FLIERS.includes(b.kind))continue; // a flier passes over ground kinds
        const min=D.SPACE[a.kind]+D.SPACE[b.kind],d=dist(a,b);
        if(d>=min)continue;
        const ux=d>0?(b.x-a.x)/d:1,uy=d>0?(b.y-a.y)/d:0,push=(min-d)*HALF;
        a.x-=ux*push;a.y-=uy*push;b.x+=ux*push;b.y+=uy*push;
      }
      for(const m of live){if(s.mode==='defense')clearCrystal(m,s.crystal);else clearHeroes(m,heroes);keepIn(s,m);}
    }
  };

  const rampRow=t=>D.RAMP.reduce((row,r)=>(r.from<=t?r:row),D.RAMP[0]);

  const pickKind=(row,s)=>{
    let roll=rand(s)*D.IDS.reduce((sum,id)=>sum+row.weights[id],0);
    for(const id of D.IDS){roll-=row.weights[id];if(roll<0)return id;}
    return D.IDS[D.IDS.length-1];
  };

  const trySpawn=(s,row,heroes)=>{
    const kind=pickKind(row,s),k=D.KINDS[kind];
    const edge=D.EDGE[kind],x=edge+rand(s)*(s.arena.w-2*edge);
    const y=Math.max(D.TOP_INSET[kind],s.arena.h*(D.SPAWN_BAND.top+rand(s)*(D.SPAWN_BAND.bottom-D.SPAWN_BAND.top)));
    if(s.monsters.filter(isLive).length>=D.LIVE_CAP)return;
    if(heroes.some(h=>dist({x,y},h)<D.SPAWN_MIN_HERO_DIST))return;
    const hp=Math.round(k.hp*row.hpScale);
    s.monsters.push({id:s.nextId++,kind,x,y,r:k.r,hp,maxHP:hp,life:'spawning',age:0,facing:1,cd:0,timer:0,spitIn:k.spitEvery||0});
  };

  // Defense: queued monsters enter at the top one ENTRY_GAP apart while fewer than the cap are live.
  const enterQueued=(s,dt)=>{
    s.entryIn-=dt;
    while(s.entryIn<=0&&s.queue.length&&s.monsters.filter(isLive).length<D.DEFENSE_LIVE_CAP){
      const kind=s.queue.shift(),e=D.EDGE[kind];
      newMonster(s,kind,e+rand(s)*(s.arena.w-2*e),D.TOP_INSET[kind],'alive');
      s.entryIn+=D.DEFENSE_ENTRY_GAP_S;
    }
    s.entryIn=Math.max(0,s.entryIn);
  };

  // No lull (owner 2026-11-20: "the wait time between waves typically ends the combo"): the tick after a wave's queue empties,
  // the next wave's queue is built and its monsters keep the entry stream going, one entry gap on, while the last wave's monsters
  // are still on the field. Won when wave 5 has fully entered and none is live. crystal hp 0 is checked first, so a lethal bite loses
  // before the win rule is read. `lull` stays 0 (progress still reports lullLeft for the HUD).
  const defenseTick=(s,dt,out)=>{
    if(s.crystal.hp<=0)return finish(s,out,'lost');
    const last=D.DEFENSE_WAVES.length;
    if(!s.queue.length&&s.wave<last){s.wave++;startWave(s);}
    enterQueued(s,dt);
    if(s.queue.length||s.wave<last||s.monsters.some(isLive))return;
    return finish(s,out,'won');
  };

  // The combo's idle clock (Long fuse stretches it), then the live counter's timer with the heroes inside its ring this tick.
  const comboTick=(s,dt,heroes,out)=>{
    const c=s.combo;
    s.heroes=heroes;
    if(c.count>0&&(c.idle+=dt)>=D.COMBO.TIMEOUT_S+(fx(s).longFuse||0)){c.count=0;c.idle=0;counterStep(s,{type:'comboTimeout'},out);}
    const z=s.counter.zone;
    if(s.counter.phase==='telegraph')
      counterStep(s,{type:'tick',dt,inZone:z?heroes.flatMap((h,i)=>dist(h,z)<=root.LoftRumbleCounterData.COUNTER_R?[i]:[]):[]},out);
  };

  const onTick=(state,ev)=>{
    if(state.outcome!=='running'||state.offer)return refuse(state);   // an open pick offer pauses the fight
    const dt=Math.min(num(ev.dt)?ev.dt:0,D.MAX_DT);
    if(!(dt>0))return refuse(state);
    const s=clone(state),out=[];
    if(s.downed)return finish(s,out,'lost');
    const heroes=Array.isArray(ev.heroes)?ev.heroes.filter(h=>num(h&&h.x)&&num(h.y)&&num(h.r)):[];
    s.monsters=s.monsters.filter(m=>m.life!=='removed');
    s.t+=dt;
    for(const m of s.monsters)stepMonster(s,m,dt,heroes,out);
    space(s,heroes);
    s.shots=s.shots.filter(sh=>stepShot(s,sh,dt,heroes,out));
    if(comboOn(s))comboTick(s,dt,heroes,out);
    if(s.mode==='defense'){defenseTick(s,dt,out);if(comboOn(s)&&s.outcome==='running')checkOffer(s,out);return{state:s,out};}
    if(s.mode==='bench'){refill(s);return{state:s,out};}
    s.spawnIn-=dt;
    while(s.spawnIn<=0){const row=rampRow(s.t);s.spawnIn+=row.interval;trySpawn(s,row,heroes);}
    if(s.mode==='hold'&&s.t>=s.goal)finish(s,out,'won');
    return{state:s,out};
  };

  const HANDLERS=Object.freeze({tick:onTick,hit:onHit,teamDown:onTeamDown,reset:onReset,pick:onPick});
  const next=(state,event)=>{
    const type=event&&event.type;
    return typeof type==='string'&&Object.prototype.hasOwnProperty.call(HANDLERS,type)?HANDLERS[type](state,event):refuse(state);
  };

  const effects=state=>fx(state);   // the picks taken so far, summed per card (reach, quickRest, bankShot and spark are the page's to apply)
  const api=Object.freeze({create,next,progress,effects});
  root.LoftRumbleSwarm=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
