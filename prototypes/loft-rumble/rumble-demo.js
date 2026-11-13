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
  function arrive(){
    delete document.documentElement.dataset.rumblePending;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const cue=document.createElement('div');cue.className='battle-arrival';cue.setAttribute('aria-hidden','true');
    const lead=document.createElement('span');lead.textContent=copy.arrivalLead;
    const title=document.createElement('strong');
    title.textContent=copy.arrivalTitle;cue.append(lead,title);
    const clear=()=>{
      cue.remove();delete document.documentElement.dataset.rumbleArriving;
      document.removeEventListener('pointerdown',clear,true);document.removeEventListener('keydown',clear,true);
    };
    document.documentElement.dataset.rumbleArriving='';document.getElementById('stage').append(cue);
    cue.addEventListener('animationend',clear,{once:true});
    document.addEventListener('pointerdown',clear,{capture:true,once:true});
    document.addEventListener('keydown',clear,{capture:true,once:true});
  }
  function reveal(ready,draw,cinematic){
    const backdrop=new Image();backdrop.src=new URL('assets/camera-storybook/arena.webp',location.href).href;
    const images=[...document.images,backdrop];
    Promise.all([Promise.resolve(ready).catch(()=>{}),...images.map(image=>image.decode().catch(()=>{}))])
      .then(()=>cinematic.done).then(continueToTitle=>{
        draw();
        if(!continueToTitle){delete document.documentElement.dataset.rumblePending;return;}
        arrive();document.getElementById('menu-toggle').focus({preventScroll:true});
      });
  }
  function install({s,names,reset:restart,draw,ready}){
    if(new URLSearchParams(location.search).get('lab')==='1')return;
    s.demo={enraged:false};document.documentElement.dataset.rumbleDemo='';
    if(document.documentElement.hasAttribute('data-published-rumble')){
      const back=document.createElement('a');back.className='demo-back';back.textContent=copy.back;
      const loft=new URL('../../',location.href);loft.searchParams.set('from','rumble');
      back.href=loft.href;document.querySelector('.top').prepend(back);
    }
    const menu=document.getElementById('menu'),toggle=document.getElementById('menu-toggle');
    const pause=document.getElementById('pause'),help=document.getElementById('help-toggle');
    toggle.replaceChildren(pause.firstElementChild.cloneNode(true));
    toggle.setAttribute('aria-label',copy.menuLabel);toggle.title=copy.menuLabel;
    pause.textContent=copy.resume;help.textContent=copy.helpMenu;
    menu.prepend(pause,help);
    names.custom=data.resident.name;
    document.querySelector('[data-resident="custom"] b').textContent=data.resident.name;
    for(const child of document.getElementById('menu').children){
      if(!data.playerControls.includes(child.id))child.hidden=true;
    }
    const brand=document.createElement('div');brand.className='pause-brand';
    const logo=document.createElement('img');logo.src='art/rumble-logo.webp';logo.alt='';
    brand.append(logo);
    const title=document.createElement('h2');title.id='pause-title';title.textContent=copy.pausedTitle;
    menu.setAttribute('aria-labelledby',title.id);
    menu.prepend(brand,title);
    menu.append(pause,document.getElementById('sound'),document.getElementById('music'),document.getElementById('haptics'),help,document.getElementById('replay-tutorial'),document.getElementById('reset'));
    const helpPanel=document.getElementById('help-panel'),helpTitle=document.createElement('h2');
    helpTitle.id='battle-help-title';helpTitle.textContent=copy.helpMenu;helpTitle.tabIndex=-1;helpTitle.autofocus=true;
    helpPanel.setAttribute('aria-labelledby',helpTitle.id);helpPanel.prepend(helpTitle);
    const helpClose=document.createElement('button');helpClose.className='help-resume';helpClose.textContent=copy.resume;
    helpClose.onclick=()=>help.click();helpPanel.append(helpClose);
    document.getElementById('team-help').textContent=copy.teamHelp;
    document.getElementById('help').textContent=copy.aimHelp;
    document.getElementById('demo-time-label').textContent=copy.time;
    document.getElementById('demo-combo-label').textContent=copy.combo;
    const replay=document.getElementById('demo-replay');replay.textContent=copy.replay;
    replay.addEventListener('click',()=>{restart();draw();document.getElementById('menu-toggle').focus({preventScroll:true})});
    restart();draw();
    const cinematic=root.LoftRumbleCinematic.play({main:document.querySelector('main'),setBlocked:on=>{s.cinematic=on}});
    reveal(ready,draw,cinematic);
  }
  root.LoftRumbleDemo=Object.freeze({active,reset,advance,rotation,interval,trackWarning,observeImpact,present,install});
})(globalThis);
