// Loft Rumble practice: a five-beat safe practice (sling, keep slinging, weak spot, special, dodge) and the battle cue rail.
// The battle keeps running in real time; practice only removes harm. Every hook is a no-op until install(), and during
// the aim forecast (camera.predicting), so the forecast never advances practice, writes storage or adds a cue.
(function(root){
  'use strict';
  const data=root.LoftRumblePracticeData,copy=data.copy,steps=data.steps;
  // mode: off (live fight), prompt (resume offer), beat (a practice step), done (dodge shown, waiting for Finish)
  // clockLive: the fight that follows practice starts its clock at once. The demo otherwise waits for the first sling,
  // a grace practice has already given; any later reset (Play again) brings the wait back.
  let host=null,mode='off',step=steps[0],granted=false,missed=false,regrant=0,events=[],clockLive=false;
  const fill=(template,values)=>template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
  const predicting=()=>!!host?.camera()?.predicting;
  const active=()=>!!host&&mode!=='off';
  const live=()=>!!host&&!predicting();
  const beatIs=(...names)=>active()&&mode==='beat'&&names.includes(step);
  const list=ids=>{const named=ids.map(id=>host.names[id]);return named.length<2?named.join(''):named.slice(0,-1).join(copy.listSep)+copy.and+named.at(-1)};
  const lead=()=>host.RT.telegraph+data.beamReadTime;
  const specialName=id=>host.specials[host.kind(id)];

  function read(){
    try{
      const raw=localStorage.getItem(data.storageKey);if(raw==null)return null;
      const record=JSON.parse(raw);
      if(record?.version!==data.version||!data.statuses.includes(record.status))return null;
      if(record.status==='incomplete'&&!steps.includes(record.step))return null;
      return record;
    }catch{return null}
  }
  // Storage denial leaves a playable session: the record simply lives only in this page.
  function save(status){
    if(predicting())return;
    const record={version:data.version,status};if(status==='incomplete')record.step=step;
    try{localStorage.setItem(data.storageKey,JSON.stringify(record))}catch{}
  }

  // Per-beat setup. The special beat lends the selected resident a full portrait; the Beam beat brings the next attack close.
  function fixtures(){
    const s=host.s;missed=false;regrant=0;
    if(step==='special'&&!granted){granted=true;s.specialCharge[data.specialResident]=1;host.roster()}
    if(step==='beam'){s.enemyT=lead();s.warn=null;s.attackFx=null}
  }
  function revokeGrant(){
    if(!granted)return;granted=false;
    host.s.specialCharge[data.specialResident]=0;host.roster();
  }
  function apply(){
    if(!host)return;
    clockLive=false;
    host.s.tutor=active()?{pull:false,bump:false,zone:false}:null;
    granted=false;
    if(mode==='beat')fixtures();
  }
  function goTo(next){
    if(step==='special')revokeGrant();
    step=next;mode='beat';save('incomplete');fixtures();render();
  }
  // Leaving practice, by Finish or Skip: the ordinary battle starts fresh, so no protection, lent charge, practice damage or
  // practice positions carry over, and the first warning gets its full lead.
  function goLive(status){
    mode='off';granted=false;save(status);
    host.reset();clockLive=true;host.message(copy.live);render();
  }
  function restart(){
    host.closeMenus();mode='beat';step=steps[0];save('incomplete');host.reset();render();
  }

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
  // A sling while the resume offer is open answers it as Continue: the offer closes and the saved beat shows, so the
  // no-damage protection is never on without its "Practice: no damage" card. The battle is not reset under the sling.
  function onFling(id){
    if(!live())return;
    if(mode==='prompt'){mode='beat';fixtures();render()}
    const body=host.s.bodies[id];
    if(body?.special==='springy')cue('special-effect',fill(copy.cue.effect,{name:host.names[id],special:host.specials.springy,effect:copy.launchEffect.springy}));
    if(beatIs('gesture'))goTo('ordinary');
  }
  function onHit(body,weak,amount){
    if(!live())return;
    const text=fill(copy.cue.hit,{actor:host.names[body.id],kind:weak?copy.cue.weakKind:copy.cue.bodyKind,amount});
    cue('hit',text);
    if(body.special&&beatIs('special'))goTo('beam');
    else if(beatIs('ordinary'))goTo('weak');
    else if(weak&&beatIs('weak'))goTo('special');
  }
  function onAlly(mover,resting,amount){
    if(!live())return;
    const values={actor:host.names[mover.id],ally:host.names[resting.id],ability:host.abilities[host.kind(resting.id)],amount};
    cue('ally',fill(amount>0?copy.cue.ally:copy.cue.allyLaunch,values));
    if(beatIs('ordinary'))goTo('weak');
  }
  function onSpecialBonus(id,amount){
    if(!live())return;
    const trait=host.kind(id);
    cue('special-effect',fill(copy.cue.effect,{name:host.names[id],special:host.specials[trait],effect:fill(copy.effect[trait],{amount})}));
  }
  // A Beam or Slam attack's result. escaped: someone threatened when the lane locked was outside it at impact.
  function onImpact(fx,escaped){
    if(!live())return;
    const def=fx.warn.def,safe=active(),hits=fx.hits,threatened=fx.warn.threatened??[];
    const values={attack:def.name,names:list(hits),amount:fx.amount};
    let text;
    if(def.id==='pulse')text=fill(safe?copy.cue.teamSafe:copy.cue.teamLive,values);
    else if(hits.length)text=fill(safe?copy.cue.caughtSafe:copy.cue.caughtLive,values);
    else if(escaped)text=fill(copy.cue.clear,{...values,names:list(threatened.filter(id=>!hits.includes(id)))});
    else text=fill(copy.cue.missed,values);
    cue('outcome',text);
    if(def.id!=='beam'||!beatIs('beam'))return;
    if(!hits.length&&escaped){mode='done';render();return}
    host.s.enemyT=Math.min(host.s.enemyT,lead());
    if(hits.length)host.message(copy.instruction.beamRetry);
  }
  function onRoot(hit,amount){
    if(!live())return;
    const text=fill(active()?copy.cue.rootSafe:copy.cue.rootLive,{names:list(hit),amount});
    cue('outcome',text);
  }
  // Simulation step: the Beam beat locks its lane inside the simulation, so it never depends on a frame being drawn;
  // a missed practice special refills after a short rest so the beat can be tried again.
  function step_(dt){
    const s=host?.s;
    if(!s||predicting()||!beatIs('beam','special'))return;
    if(step==='beam'){if(!s.warn&&!s.attackFx&&s.enemyT<=host.RT.telegraph)host.ensureWarn();return}
    const id=data.specialResident,body=s.bodies[id];
    if(!granted||body.moving||s.specialCharge[id]>=1)return;
    missed=true;regrant+=dt;
    if(regrant>=data.regrantDelay){regrant=0;missed=false;s.specialCharge[id]=1;host.roster()}
  }
  const forcedAttack=attacks=>beatIs('beam')?attacks.find(attack=>attack.id==='beam'):null;
  // The teaching Beam aims straight at a resting resident, so it always threatens someone.
  function beamTarget(){
    if(!beatIs('beam'))return null;
    const bodies=host.ids.map(id=>host.s.bodies[id]);
    return bodies.find(body=>!body.moving&&!host.stunned(body))??bodies[0];
  }

  // What the view shows. Danger first, then stuns, the newest events and every ready special.
  function dangerCues(){
    const s=host.s,fx=s.attackFx,pending=fx&&!fx.hit,out=[];
    if(s.phase!=='play'||s.hp<=0)return out;
    const warn=pending?fx.warn:s.warn&&s.enemyT<=host.RT.telegraph?s.warn:null;
    if(warn){
      const members=host.ids.filter(id=>host.inZone(warn,s.bodies[id])),seconds=Math.max(0,s.enemyT).toFixed(data.countdownDigits);
      const values={attack:warn.def.name,names:list(members),seconds};
      const template=warn.def.id==='pulse'?(pending?copy.cue.dangerTeamNow:copy.cue.dangerTeam)
        :!members.length?(pending?null:copy.cue.dangerClear):pending?copy.cue.dangerNow:copy.cue.danger;
      if(template)out.push({kind:'danger',text:fill(template,values)});
    }
    const root=host.rootDanger();
    if(root.length)out.push({kind:'danger',text:fill(copy.cue.root,{names:list(root)})});
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
  function panel(){
    if(!active()||host.s.phase!=='play')return null;
    const id=data.specialResident,name=host.names[id];
    if(mode==='prompt')return {title:copy.title.resume,instruction:copy.instruction.resume,
      actions:[{id:'resume',label:copy.resume,primary:true},{id:'skip',label:copy.skipPractice}]};
    if(mode==='done')return {step,title:copy.title.done,instruction:copy.instruction.done,
      actions:[{id:'finish',label:copy.finish,primary:true}]};
    const actions=[];
    if(step==='weak')actions.push({id:'skip-weak',label:copy.skipWeak});
    if(step==='special')actions.push({id:'skip-special',label:copy.skipSpecial});
    actions.push({id:'skip',label:copy.skipPractice,quiet:true});
    const instruction=step==='special'&&missed?copy.instruction.specialMissed:copy.instruction[step];
    return {step,title:copy.title[step],progress:fill(copy.progress,{n:steps.indexOf(step)+1,total:steps.length}),
      instruction:fill(instruction,{name,special:specialName(id)}),actions};
  }
  function render(){
    if(!host||predicting())return;
    const alert=[...dangerCues(),...stunCue()],news=[...events.slice(0,data.eventCueMax),...readyCues()];
    // A changed card resizes its grid row; refit the arena now rather than on the next ResizeObserver delivery,
    // so a press right after a beat change lands where the resident is drawn.
    if(root.LoftRumblePracticeView.render({panel:panel(),alert,news,top:host.hudTop*host.s.scale}))host.relayout?.();
  }
  const actions={
    resume(){mode='beat';host.reset();render()},
    skip(){goLive('skipped')},
    'skip-weak'(){goTo('special')},
    'skip-special'(){goTo('beam')},
    finish(){goLive('completed')}
  };

  function install(options){
    host=options;events=[];
    const record=read();
    if(record?.status==='completed'||record?.status==='skipped')mode='off';
    else if(record?.status==='incomplete'){mode='prompt';step=record.step}
    else{mode='beat';step=steps[0];save('incomplete')}
    root.LoftRumblePracticeView.install({copy,act:id=>actions[id]?.(),replayButton:trigger=>confirmReplay(trigger)});
    apply();render();
  }
  function confirmReplay(trigger){
    root.LoftRumblePracticeView.confirm({trigger,accept:restart});
  }

  root.LoftRumblePractice=Object.freeze({install,installed:()=>!!host,active,clockLive:()=>clockLive,danger:()=>!!host&&dangerCues().length>0,
    reset:apply,tick,render,step:step_,forcedAttack,beamTarget,
    onFling,onHit,onAlly,onSpecialBonus,onImpact,onRoot,confirmReplay});
})(globalThis);
