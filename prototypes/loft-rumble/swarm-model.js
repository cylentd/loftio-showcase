(function(root){
  'use strict';
  // Swarm model (ledger #487). Pure: next(state, event) -> {state, out[]}. The state is plain JSON (it can be cloned and saved), its
  // dice are a seeded generator held in state.rng, and next never changes the state it is given. A refused event returns that same
  // state and no out. All numbers come from swarm-data.js; the runtime owns the team HP pool and sends teamDown when it empties.
  //
  // Events (all carry `type`): tick {dt, heroes:[{x,y,r}]}, hit {id, amount}, teamDown, reset.
  // Out (all carry `type`): teamDamage {amount, x, y, by}, killed {id, kind, x, y}, outcome {value}.
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

  const clone=s=>JSON.parse(JSON.stringify(s));
  const refuse=state=>({state,out:[]});
  const num=v=>typeof v==='number'&&Number.isFinite(v);
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const isLive=m=>m.life==='spawning'||m.life==='alive';

  const create=({mode,seed,arena}={})=>{
    const m=D.MODES[mode];
    if(!m)throw new Error('swarm: unknown mode '+String(mode));
    const a=arena||D.ARENA;
    return{mode,goal:m.goal,t:0,kills:0,rng:seed|0,seed:seed|0,arena:{w:a.w,h:a.h},spawnIn:D.FIRST_SPAWN_S,nextId:1,
      monsters:[],shots:[],downed:false,outcome:'running'};
  };

  const progress=s=>{
    const done=s.mode==='hunt'?s.kills:s.t;
    return{mode:s.mode,kills:s.kills,goal:s.goal,t:s.t,remaining:Math.max(0,s.goal-done),frac:Math.min(1,Math.max(0,done/s.goal))};
  };

  const finish=(s,out,value)=>{s.outcome=value;out.push({type:'outcome',value});return{state:s,out};};

  const onHit=(state,ev)=>{
    if(state.outcome!=='running'||!num(ev.amount)||ev.amount<=0)return refuse(state);
    const idx=state.monsters.findIndex(m=>m.id===ev.id&&m.life==='alive');
    if(idx<0)return refuse(state);
    const s=clone(state),m=s.monsters[idx],out=[];
    m.hp=Math.max(0,m.hp-ev.amount);
    if(m.hp>0)return{state:s,out};
    m.life='dying';m.timer=0;s.kills++;
    out.push({type:'killed',id:m.id,kind:m.kind,x:m.x,y:m.y});
    if(s.mode==='hunt'&&s.kills>=s.goal)finish(s,out,'won');
    return{state:s,out};
  };

  const onTeamDown=state=>{
    if(state.outcome!=='running'||state.downed)return refuse(state);
    const s=clone(state);s.downed=true;
    return{state:s,out:[]};
  };

  const onReset=state=>({state:create({mode:state.mode,seed:state.seed,arena:state.arena}),out:[]});

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

  const stepMonster=(s,m,dt,heroes,out)=>{
    m.age+=dt;
    if(m.life==='spawning'){if(m.age>=D.SPAWN_RUNE_S)m.life='alive';}
    else if(m.life==='dying'){m.timer+=dt;if(m.timer>=D.DYING_S)m.life='removed';}
    else if(m.life==='alive')stepAlive(s,m,dt,heroes,out);
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

  const rampRow=t=>D.RAMP.reduce((row,r)=>(r.from<=t?r:row),D.RAMP[0]);

  const pickKind=(row,s)=>{
    let roll=rand(s)*D.IDS.reduce((sum,id)=>sum+row.weights[id],0);
    for(const id of D.IDS){roll-=row.weights[id];if(roll<0)return id;}
    return D.IDS[D.IDS.length-1];
  };

  const trySpawn=(s,row,heroes)=>{
    const kind=pickKind(row,s),k=D.KINDS[kind];
    const x=k.r+rand(s)*(s.arena.w-2*k.r);
    const y=s.arena.h*(D.SPAWN_BAND.top+rand(s)*(D.SPAWN_BAND.bottom-D.SPAWN_BAND.top));
    if(s.monsters.filter(isLive).length>=D.LIVE_CAP)return;
    if(heroes.some(h=>dist({x,y},h)<D.SPAWN_MIN_HERO_DIST))return;
    const hp=Math.round(k.hp*row.hpScale);
    s.monsters.push({id:s.nextId++,kind,x,y,r:k.r,hp,maxHP:hp,life:'spawning',age:0,facing:1,cd:0,timer:0,spitIn:k.spitEvery||0});
  };

  const onTick=(state,ev)=>{
    if(state.outcome!=='running')return refuse(state);
    const dt=Math.min(num(ev.dt)?ev.dt:0,D.MAX_DT);
    if(!(dt>0))return refuse(state);
    const s=clone(state),out=[];
    if(s.downed)return finish(s,out,'lost');
    const heroes=Array.isArray(ev.heroes)?ev.heroes.filter(h=>num(h&&h.x)&&num(h.y)&&num(h.r)):[];
    s.monsters=s.monsters.filter(m=>m.life!=='removed');
    s.t+=dt;
    for(const m of s.monsters)stepMonster(s,m,dt,heroes,out);
    s.shots=s.shots.filter(sh=>stepShot(s,sh,dt,heroes,out));
    s.spawnIn-=dt;
    while(s.spawnIn<=0){const row=rampRow(s.t);s.spawnIn+=row.interval;trySpawn(s,row,heroes);}
    if(s.mode==='hold'&&s.t>=s.goal)finish(s,out,'won');
    return{state:s,out};
  };

  const HANDLERS=Object.freeze({tick:onTick,hit:onHit,teamDown:onTeamDown,reset:onReset});
  const next=(state,event)=>{
    const type=event&&event.type;
    return typeof type==='string'&&Object.prototype.hasOwnProperty.call(HANDLERS,type)?HANDLERS[type](state,event):refuse(state);
  };

  const api=Object.freeze({create,next,progress});
  root.LoftRumbleSwarm=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
