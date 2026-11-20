(function(root){
  'use strict';
  const data=root.LoftRumbleEncounterData;
  const ATTACKS=['whiplash','beam','slam']; // the attack ids a rotation may hold, each once
  const normalized=value=>Number.isFinite(value)&&value>0&&value<1;
  function validate(input){
    if(!input||!Array.isArray(input.entries)||!input.entries.length)throw new TypeError('Missing encounters');
    const identifiers=new Set();
    for(const entry of input.entries){
      if(!entry.id||identifiers.has(entry.id)||!entry.label||!entry.description)throw new TypeError('Invalid encounter identity');
      identifiers.add(entry.id);
      if(entry.boss&&(!normalized(entry.boss.x)||!normalized(entry.boss.y)||!Number.isFinite(entry.boss.angle)))throw new TypeError('Invalid boss placement');
      if(entry.bumpers&&(!Array.isArray(entry.bumpers)||!entry.bumpers.every(point=>Array.isArray(point)&&point.length===2&&point.every(normalized))))throw new TypeError('Invalid bumper placement');
      if(entry.rotation&&(!Array.isArray(entry.rotation)||entry.rotation.length!==ATTACKS.length||new Set(entry.rotation).size!==ATTACKS.length||!entry.rotation.every(id=>ATTACKS.includes(id))))throw new TypeError('Invalid attack rotation');
      if(entry.starts&&(!['sprout','chomper','custom'].every(id=>Array.isArray(entry.starts[id])&&entry.starts[id].length===2&&entry.starts[id].every(normalized))))throw new TypeError('Invalid resident placement');
    }
    if(!identifiers.has(input.defaultId))throw new TypeError('Missing default encounter');
    return true;
  }
  validate(data);
  const current=state=>data.entries.find(entry=>entry.id===state.encounterId)??data.entries.find(entry=>entry.id===data.defaultId);
  function enemy(state,fallback){
    const boss=current(state).boss;
    return boss?{x:state.w*boss.x,y:state.h*boss.y,angle:boss.angle}:fallback;
  }
  function rotation(state,attacks){
    const order=current(state).rotation;
    return order?order.map(id=>attacks.find(attack=>attack.id===id)):attacks;
  }
  function apply(state,feel){
    const entry=current(state);
    if(entry.bumpers)feel.bumpers=structuredClone(entry.bumpers);
    for(const [id,point] of Object.entries(entry.starts??{}))Object.assign(state.bodies[id],{x:state.w*point[0],y:state.h*point[1]});
    if(entry.id!==data.defaultId)state.tutor=null;
  }
  // A swarm in the fight: its ?stage id and short name, or null. The control shows it as a locked option, no description.
  function swarmStage(state){
    const mode=state.swarm?.model?.mode,label=data.swarm.labels[mode];
    return label?{id:Object.keys(data.swarm.stages).find(id=>data.swarm.stages[id]===mode),label}:null;
  }
  function sync(state){
    const select=document.getElementById('rumble-encounter');
    if(!select)return;
    const entry=current(state),swarm=swarmStage(state),layout=document.getElementById('stage-layout');
    let option=swarm?select.querySelector('option[data-swarm]'):null; // no swarm: the control is untouched (Bramble path)
    if(swarm&&!option){option=document.createElement('option');option.dataset.swarm='';select.append(option)}
    if(option){option.hidden=!swarm;if(swarm)Object.assign(option,{value:swarm.id,textContent:swarm.label})}
    select.disabled=!!swarm;
    select.value=swarm?swarm.id:entry.id;
    document.getElementById('rumble-encounter-note').textContent=swarm?'':entry.description;
    const status=document.getElementById('stage-label');if(status)status.textContent=swarm?swarm.label:entry.label;
    if(layout)layout.disabled=!!entry.bumpers;
    const note=document.getElementById('stage-layout-note');
    if(note)note.textContent=entry.bumpers?data.layoutNote:root.LoftRumbleStageLayoutData.note;
  }
  function install({s,reset,draw,close}){
    const menu=document.getElementById('menu');
    if(!menu||document.getElementById('rumble-encounter'))return;
    let saved;
    try{saved=localStorage.getItem(data.storageKey)}catch{}
    s.encounterId=data.entries.some(entry=>entry.id===saved)?saved:data.defaultId;
    const label=document.createElement('label'),caption=document.createElement('span');
    label.className='arena-skin-control';label.htmlFor='rumble-encounter';caption.textContent=data.label;
    const select=document.createElement('select'),note=document.createElement('small');
    select.id='rumble-encounter';note.id='rumble-encounter-note';select.setAttribute('aria-describedby',note.id);
    for(const entry of data.entries){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.label;select.append(option)}
    select.addEventListener('change',()=>{
      if(!data.entries.some(entry=>entry.id===select.value)||s.encounterId===select.value)return;
      s.encounterId=select.value;
      try{localStorage.setItem(data.storageKey,s.encounterId)}catch{}
      reset();close();draw();
    });
    label.append(caption,select,note);menu.prepend(label);reset();draw();
  }
  // ?stage=swarm-hunt|swarm-hold -> the swarm mode, or null (the default encounter runs). While the swarm is not live the stage
  // is honoured only with the lab (the caller passes LoftRumbleLabPolicy.allowed). An unknown value is null, never an error.
  function stageMode(search,{live,lab}){
    const value=new URLSearchParams(search).get(data.swarm.param);
    if(!Object.prototype.hasOwnProperty.call(data.swarm.stages,value))return null;
    return live||lab?data.swarm.stages[value]:null;
  }
  root.LoftRumbleEncounters=Object.freeze({validate,current,enemy,rotation,apply,sync,install,stageMode});
})(globalThis);
