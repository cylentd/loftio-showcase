// Loft Rumble battle cues. Since 2026-11-14 the live fight puts no sentence on screen (owner, ledger #333): every event
// shows on the field. A boss attack names itself at the boss bar and marks each resident it will hit; a stun circles the
// resident and drains its dock portrait; a first ally bump cuts in; a ready special stamps READY; a weak hit or a dodge
// pops one word, and so does a combo milestone. Cut-ins, stamps and word pops are moments: one at a time, and one that
// cannot show within its wait is dropped. The sentences remain for screen readers: the soonest danger, else a stun, in a visually hidden list, and every
// other cue as news in the visually hidden live region (owner's option a, 2026-11-13). The battle runs in real time and
// the cues only report. Every hook is a no-op until install(), and during the aim forecast (camera.predicting).
(function(root){
  'use strict';
  const data=root.LoftRumbleCuesData,copy=data.copy;
  let host=null,events=[],moment=null,waiting=null,stunTotal={};
  const fill=(template,values)=>template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
  const predicting=()=>!!host?.camera()?.predicting;
  const paused=()=>!!host?.paused();  // Training coaches in its own words, so the cues stay quiet while it runs
  const live=()=>!!host&&!predicting()&&!paused();
  const list=ids=>{const named=ids.map(id=>host.names[id]);return named.length<2?named.join(''):named.slice(0,-1).join(copy.listSep)+copy.and+named.at(-1)};

  function cue(kind,text){
    if(predicting())return;
    events=events.filter(item=>item.kind!==kind);events.unshift({kind,text,life:data.cueLife});
  }

  // Moments. A word pop is reward decoration, so it also waits while a danger shows (the old rule for grades and combos).
  const blocked=item=>item.kind==='word'&&dangerCues().length>0;
  function offer(item){
    if(!live())return false;
    if(!moment&&!blocked(item))moment={...item,life:data.moment[item.kind]};
    else waiting={...item,age:0};  // a newer moment replaces an older one still waiting: the fresher news wins
    return true;
  }
  function tick(real){
    if(!host)return;
    for(const item of events)item.life-=real;
    events=events.filter(item=>item.life>0);
    if(moment&&(moment.life-=real)<=0)moment=null;
    if(waiting&&(waiting.age+=real)>data.moment.wait)waiting=null;
    if(!moment&&waiting&&!blocked(waiting)){moment={...waiting,life:data.moment[waiting.kind]};waiting=null}
  }

  // Hooks the battle calls. Each names the actor, the cause and the actual result.
  function onFling(id){
    if(!live())return;
    const body=host.s.bodies[id];
    if(body?.special==='springy')cue('special-effect',fill(copy.cue.effect,{name:host.names[id],special:host.specials.springy,effect:copy.launchEffect.springy}));
  }
  function onHit(body,weak,amount){
    if(!live())return;
    cue('hit',fill(copy.cue.hit,{actor:host.names[body.id],kind:weak?copy.cue.weakKind:copy.cue.bodyKind,amount}));
    if(weak&&host.s.lastHit)offer({kind:'word',word:'weak',text:fill(copy.field.word.weak,{multiplier:host.weakMultiplier}),at:{...host.s.lastHit}});
  }
  // A combo milestone (its index in FEEL.comboMilestones) at the hit that reached it. True when the cues own it, so the
  // battle skips its canvas call and one event never pops twice.
  function onCombo(index,at){
    const text=copy.field.word.combo[index];
    return !!text&&offer({kind:'word',word:'combo',text,at:{x:at.x,y:at.y}});
  }
  function onAlly(mover,resting,amount){
    if(!live())return;
    const values={actor:host.names[mover.id],ally:host.names[resting.id],ability:host.abilities[host.kind(resting.id)],amount};
    cue('ally',fill(amount>0?copy.cue.ally:copy.cue.allyLaunch,values));
  }
  // The first bump by an ally in a fight. True when the cues own it, so the battle skips its old toast card.
  function onAllyIntro(id){return offer({kind:'cutin',id})}
  function onReady(id){offer({kind:'ready',id})}
  function onSpecialBonus(id,amount){
    if(!live())return;
    const trait=host.kind(id);
    cue('special-effect',fill(copy.cue.effect,{name:host.names[id],special:host.specials[trait],effect:fill(copy.effect[trait],{amount})}));
  }
  // A Beam or Slam attack's result. escaped: someone threatened when the lane locked was outside it at impact.
  function onImpact(fx,escaped){
    if(!live())return;
    const def=fx.warn.def,hits=fx.hits,threatened=fx.warn.threatened??[];
    const values={attack:def.name,names:list(hits),amount:fx.amount};
    let text;
    if(def.id==='pulse')text=fill(copy.cue.teamLive,values);
    else if(hits.length)text=fill(copy.cue.caughtLive,values);
    else if(escaped)text=fill(copy.cue.clear,{...values,names:list(threatened.filter(id=>!hits.includes(id)))});
    else text=fill(copy.cue.missed,values);
    cue('outcome',text);
    const dodger=escaped&&threatened.find(id=>!hits.includes(id));
    if(dodger)offer({kind:'word',word:'dodge',text:copy.field.word.dodge,at:{x:host.s.bodies[dodger].x,y:host.s.bodies[dodger].y}});
  }
  function onRoot(hit,amount){
    if(!live())return;
    cue('outcome',fill(copy.cue.rootLive,{names:list(hit),amount}));
  }

  // Dangers carry `at`, the seconds to their impact (0 once it lands), `clear` when they threaten nobody (which ranks
  // them below every danger that names a resident), `ids`, the residents they will hit, and `name`, the attack's name.
  function dangerCues(){
    const s=host.s,fx=s.attackFx,pending=fx&&!fx.hit,out=[];
    if(s.phase!=='play'||s.hp<=0)return out;
    const warn=pending?fx.warn:s.warn&&s.enemyT<=host.RT.telegraph?s.warn:null;
    if(warn){
      const team=warn.def.id==='pulse',members=host.ids.filter(id=>host.inZone(warn,s.bodies[id]));
      const seconds=Math.max(0,s.enemyT).toFixed(data.countdownDigits),values={attack:warn.def.name,names:list(members),seconds};
      const template=team?(pending?copy.cue.dangerTeamNow:copy.cue.dangerTeam)
        :!members.length?(pending?null:copy.cue.dangerClear):pending?copy.cue.dangerNow:copy.cue.danger;
      if(template)out.push({kind:'danger',text:fill(template,values),at:pending?0:Math.max(0,s.enemyT),
        clear:!team&&!members.length,ids:team?[...host.ids]:members,name:warn.def.name});
    }
    const root=host.rootDanger();
    if(root.length)out.push({kind:'danger',text:fill(copy.cue.root,{names:list(root)}),at:Math.max(0,host.rootWarn()??0),clear:false,ids:root,name:copy.field.rootSnap});
    return out.sort((a,b)=>a.clear-b.clear||a.at-b.at);
  }
  function stunned(){return host.ids.filter(id=>host.stunned(host.s.bodies[id]))}
  function stunCue(){
    const s=host.s,ids=stunned();
    if(!ids.length||s.phase!=='play')return [];
    const seconds=Math.max(...ids.map(id=>s.bodies[id].stun??0)).toFixed(data.countdownDigits);
    return [{kind:'stun',text:fill(copy.cue.stun,{names:list(ids),seconds})}];
  }
  const ready=()=>host.s.phase!=='play'?[]:host.ids.filter(id=>host.s.specialCharge[id]>=1&&!host.stunned(host.s.bodies[id]));
  function readyCues(){
    return ready().map(id=>{
      const trait=host.kind(id);
      return {kind:'special-ready',text:fill(copy.cue.ready,{name:host.names[id],special:host.specials[trait],effect:fill(copy.effect[trait],{amount:host.specialBonus[trait]})})};
    });
  }

  // The field: what a sighted player sees. Positions are in arena CSS px from host.place.
  function field(){
    const none={attack:null,targets:[],stunned:[],ready:[],moment:null};
    if(!host||paused()||host.s.phase!=='play')return none;
    const s=host.s,dangers=dangerCues(),lift=amount=>point=>({x:point.x,y:point.y-amount*s.scale});
    const targets=[...new Set(dangers.flatMap(danger=>danger.ids))].map(id=>{
      const soonest=Math.min(...dangers.filter(danger=>danger.ids.includes(id)).map(danger=>danger.at));
      return {id,flash:soonest<=data.field.markerFlash,...lift(data.field.markerLift)(host.place(s.bodies[id]))};
    });
    const now=stunned();
    for(const id of Object.keys(stunTotal))if(!now.includes(id))delete stunTotal[id];
    const stuns=now.map(id=>{
      const left=s.bodies[id].stun;stunTotal[id]=Math.max(stunTotal[id]??0,left);
      return {id,left:left/stunTotal[id],...lift(data.field.spiralLift)(host.place(s.bodies[id]))};
    });
    const shown=moment&&{...moment,...(moment.at?lift(data.field.wordLift)(host.place(moment.at)):{}),
      ability:moment.kind==='cutin'?host.abilities[host.kind(moment.id)]:undefined};
    return {attack:dangers[0]?{id:dangers[0].name,name:dangers[0].name}:null,targets,stunned:stuns,ready:ready(),moment:shown};
  }

  function render(){
    if(!host||predicting())return;
    const quiet=paused(),alert=quiet?[]:[...dangerCues().map(({kind,text})=>({kind,text})),...stunCue()].slice(0,data.alertMax);
    const news=quiet?[]:[...events.slice(0,data.eventCueMax),...readyCues()];
    root.LoftRumbleCuesView.render({alert,news,top:host.hudTop*host.s.scale,field:field()});
  }
  function install(options){
    host=options;events=[];moment=null;waiting=null;stunTotal={};
    root.LoftRumbleCuesView.install({copy,art:data.art,plate:data.field.plate,cells:data.field.cells,life:data.moment});
    render();
  }
  // A new battle (Play again) clears moments the last one left.
  function reset(){moment=null;waiting=null;stunTotal={};events=[]}

  root.LoftRumbleCues=Object.freeze({install,reset,installed:()=>!!host,danger:()=>!!host&&!paused()&&dangerCues().length>0,
    drawsStun:()=>!!host&&root.LoftRumbleCuesView.hasArt('stunSpiral'),field,
    tick,render,onFling,onHit,onCombo,onAlly,onAllyIntro,onReady,onSpecialBonus,onImpact,onRoot});
})(globalThis);
