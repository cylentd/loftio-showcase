(function(root){
  'use strict';
  const data=root.LoftRumbleDemoData,copy=data.copy;
  const active=state=>!!state.demo;
  function reset(state){
    if(!active(state))return;
    state.demo={enraged:false};state.encounterId=root.LoftRumbleEncounterData.defaultId;
    state.custom=data.resident.trait;
  }
  function advance(state,rules){
    if(!active(state)||state.demo.enraged||state.phase!=='play'||state.hp<=0
      ||state.hp>rules.hp*data.enrageAt||state.warn||state.attackFx)return false;
    state.demo.enraged=true;state.attackIndex=0;
    state.enemyT=Math.max(state.enemyT,rules.telegraph+data.enrageLead);
    return true;
  }
  function rotation(state,attacks){
    return state.demo?.enraged?data.rotation.map(id=>attacks.find(attack=>attack.id===id)):attacks;
  }
  const interval=(state,rules)=>state.demo?.enraged?data.enragedInterval:rules.attackEvery;
  function trackWarning(state,warning,inside){
    if(!active(state)||!state.tutor||warning.def.id==='pulse')return;
    warning.threatened=Object.keys(state.bodies).filter(id=>inside(warning,state.bodies[id]));
  }
  function observeImpact(state,warning,hits){
    if(!active(state)||!state.tutor||warning.def.id==='pulse')return false;
    if(!warning.threatened?.some(id=>!hits.includes(id)))return false;
    state.tutor.zone=true;return true;
  }
  const clock=seconds=>Math.floor(seconds/data.secondsPerMinute)+':'+String(Math.floor(seconds%data.secondsPerMinute)).padStart(2,'0');
  function present(state,ready){
    if(!active(state))return;
    const panel=document.getElementById('demo-results'),wasHidden=panel.hidden;
    panel.hidden=!ready;
    document.getElementById('stage-label').textContent=state.demo.enraged?copy.enragedBoss:copy.boss;
    if(!ready)return;
    panel.dataset.outcome=state.won?'victory':'defeat';
    document.getElementById('demo-result-title').textContent=state.won?copy.victory:copy.defeat;
    document.getElementById('demo-result-hint').textContent=state.won?copy.winHint:copy.lossHint;
    document.getElementById('demo-time').textContent=clock(state.time);
    document.getElementById('demo-combo').textContent=String(state.hitsPeak);
    if(wasHidden)document.getElementById('demo-replay').focus({preventScroll:true});
  }
  function install({s,names,reset:restart,draw}){
    if(new URLSearchParams(location.search).get('lab')==='1')return;
    s.demo={enraged:false};document.documentElement.dataset.rumbleDemo='';
    if(document.documentElement.hasAttribute('data-published-rumble')){
      const back=document.createElement('a');back.className='demo-back';back.textContent=copy.back;
      back.href=new URL('../../',location.href).href;document.querySelector('.top').prepend(back);
    }
    names.custom=data.resident.name;
    document.querySelector('[data-resident="custom"] b').textContent=data.resident.name;
    for(const child of document.getElementById('menu').children){
      if(!data.playerControls.includes(child.id))child.hidden=true;
    }
    document.getElementById('team-help').textContent=copy.teamHelp;
    document.getElementById('help').textContent=copy.aimHelp;
    document.getElementById('demo-time-label').textContent=copy.time;
    document.getElementById('demo-combo-label').textContent=copy.combo;
    const replay=document.getElementById('demo-replay');replay.textContent=copy.replay;
    replay.addEventListener('click',()=>{restart();draw();document.getElementById('pause').focus({preventScroll:true})});
    restart();draw();
  }
  root.LoftRumbleDemo=Object.freeze({active,reset,advance,rotation,interval,trackWarning,observeImpact,present,install});
})(globalThis);
