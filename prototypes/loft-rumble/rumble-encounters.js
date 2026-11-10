(function(root){
  'use strict';
  const data=root.LoftRumbleEncounterData;
  const normalized=value=>Number.isFinite(value)&&value>0&&value<1;
  function validate(input){
    if(!input||!Array.isArray(input.entries)||!input.entries.length)throw new TypeError('Missing encounters');
    const identifiers=new Set();
    for(const entry of input.entries){
      if(!entry.id||identifiers.has(entry.id)||!entry.label||!entry.description)throw new TypeError('Invalid encounter identity');
      identifiers.add(entry.id);
      if(entry.boss&&(!normalized(entry.boss.x)||!normalized(entry.boss.y)||!Number.isFinite(entry.boss.angle)))throw new TypeError('Invalid boss placement');
      if(entry.bumpers&&(!Array.isArray(entry.bumpers)||!entry.bumpers.every(point=>Array.isArray(point)&&point.length===2&&point.every(normalized))))throw new TypeError('Invalid bumper placement');
      if(entry.rotation&&(!Array.isArray(entry.rotation)||entry.rotation.length!==3||new Set(entry.rotation).size!==3||!entry.rotation.every(id=>['pulse','beam','slam'].includes(id))))throw new TypeError('Invalid attack rotation');
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
  function sync(state){
    const select=document.getElementById('rumble-encounter');
    if(!select)return;
    const entry=current(state),layout=document.getElementById('stage-layout');
    select.value=entry.id;
    document.getElementById('rumble-encounter-note').textContent=entry.description;
    const status=document.getElementById('stage-label');if(status)status.textContent=entry.label;
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
  root.LoftRumbleEncounters=Object.freeze({validate,current,enemy,rotation,apply,sync,install});
})(globalThis);
