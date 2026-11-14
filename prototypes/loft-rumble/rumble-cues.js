// Loft Rumble battle cue rail: names the actor, the cause and the actual result of every hit, bump, special and attack.
// On screen it shows one line, the most urgent danger or else a stun; every other cue is news for the visually hidden
// live region (owner's option a, 2026-11-13). The battle runs in real time and the rail only reports. Every hook is a no-op until install(), and during the aim
// forecast (camera.predicting), so the forecast never adds a cue.
(function(root){
  'use strict';
  const data=root.LoftRumbleCuesData,copy=data.copy;
  let host=null,events=[];
  const fill=(template,values)=>template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
  const predicting=()=>!!host?.camera()?.predicting;
  const paused=()=>!!host?.paused();  // Training coaches in its own words, so the rail stays quiet while it runs
  const live=()=>!!host&&!predicting()&&!paused();
  const list=ids=>{const named=ids.map(id=>host.names[id]);return named.length<2?named.join(''):named.slice(0,-1).join(copy.listSep)+copy.and+named.at(-1)};

  function cue(kind,text){
    if(predicting())return;
    events=events.filter(item=>item.kind!==kind);events.unshift({kind,text,life:data.cueLife});
  }
  function tick(real){
    if(!host||!events.length)return;
    for(const item of events)item.life-=real;
    events=events.filter(item=>item.life>0);
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
  }
  function onAlly(mover,resting,amount){
    if(!live())return;
    const values={actor:host.names[mover.id],ally:host.names[resting.id],ability:host.abilities[host.kind(resting.id)],amount};
    cue('ally',fill(amount>0?copy.cue.ally:copy.cue.allyLaunch,values));
  }
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
  }
  function onRoot(hit,amount){
    if(!live())return;
    cue('outcome',fill(copy.cue.rootLive,{names:list(hit),amount}));
  }

  // Dangers carry `at`, the seconds to their impact (0 once it lands), so the rail can show the soonest one, and `clear`
  // when they threaten nobody, which ranks them below every danger that names a resident.
  function dangerCues(){
    const s=host.s,fx=s.attackFx,pending=fx&&!fx.hit,out=[];
    if(s.phase!=='play'||s.hp<=0)return out;
    const warn=pending?fx.warn:s.warn&&s.enemyT<=host.RT.telegraph?s.warn:null;
    if(warn){
      const members=host.ids.filter(id=>host.inZone(warn,s.bodies[id])),seconds=Math.max(0,s.enemyT).toFixed(data.countdownDigits);
      const values={attack:warn.def.name,names:list(members),seconds};
      const template=warn.def.id==='pulse'?(pending?copy.cue.dangerTeamNow:copy.cue.dangerTeam)
        :!members.length?(pending?null:copy.cue.dangerClear):pending?copy.cue.dangerNow:copy.cue.danger;
      const clear=warn.def.id!=='pulse'&&!members.length;  // threatens nobody, so any danger that names a resident outranks it
      if(template)out.push({kind:'danger',text:fill(template,values),at:pending?0:Math.max(0,s.enemyT),clear});
    }
    const root=host.rootDanger();
    if(root.length)out.push({kind:'danger',text:fill(copy.cue.root,{names:list(root)}),at:Math.max(0,host.rootWarn()??0),clear:false});
    return out;
  }
  function stunCue(){
    const s=host.s,stunned=host.ids.filter(id=>host.stunned(s.bodies[id]));
    if(!stunned.length||s.phase!=='play')return [];
    const seconds=Math.max(...stunned.map(id=>s.bodies[id].stun??0)).toFixed(data.countdownDigits);
    return [{kind:'stun',text:fill(copy.cue.stun,{names:list(stunned),seconds})}];
  }
  function readyCues(){
    const s=host.s;if(s.phase!=='play')return [];
    return host.ids.filter(id=>s.specialCharge[id]>=1&&!host.stunned(s.bodies[id])).map(id=>{
      const trait=host.kind(id);
      return {kind:'special-ready',text:fill(copy.cue.ready,{name:host.names[id],special:host.specials[trait],effect:fill(copy.effect[trait],{amount:host.specialBonus[trait]})})};
    });
  }
  // The visible line: the soonest danger that names a resident, then a clear warning, else a stun. News (events and
  // readiness) is spoken, never drawn.
  function urgent(){
    const soonest=dangerCues().sort((a,b)=>a.clear-b.clear||a.at-b.at).map(({kind,text})=>({kind,text}));
    return [...soonest,...stunCue()].slice(0,data.alertMax);
  }
  function render(){
    if(!host||predicting())return;
    const quiet=paused(),alert=quiet?[]:urgent();
    const news=quiet?[]:[...events.slice(0,data.eventCueMax),...readyCues()];
    root.LoftRumbleCuesView.render({alert,news,top:host.hudTop*host.s.scale});
  }
  function install(options){
    host=options;events=[];
    root.LoftRumbleCuesView.install({copy});
    render();
  }

  root.LoftRumbleCues=Object.freeze({install,installed:()=>!!host,danger:()=>!!host&&!paused()&&dangerCues().length>0,
    tick,render,onFling,onHit,onAlly,onSpecialBonus,onImpact,onRoot});
})(globalThis);
