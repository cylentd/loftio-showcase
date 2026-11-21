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
    if(!active(state)||warning.def.id==='pulse')return;
    warning.threatened=Object.keys(state.bodies).filter(id=>inside(warning,state.bodies[id]));
  }
  function observeImpact(state,warning,hits){
    if(!active(state)||warning.def.id==='pulse')return false;
    if(!warning.threatened?.some(id=>!hits.includes(id)))return false;
    if(state.tutor)state.tutor.zone=true;
    return true;
  }
  // ---- Results screen (LM6c, owner's living-magic results kit, 2026-11-15). ----
  // Title over the victory stage with the team standing on its floor, a summary band, one row per resident (tap a row to
  // open its breakdown under it, one open at a time), and an action footer that never scrolls. Every list is data.
  // Built once per showing, not per frame, so a tap target never vanishes under the finger.
  const look=data.results;
  let originalRoster;
  function rememberRoster(){
    originalRoster??=Object.fromEntries(Object.keys(look.originalRoster).map(id=>
      [id,root.document?.querySelector(`[data-resident="${id}"] .portrait img`)?.src]));
  }
  let residentNames={};
  const make=(tag,props={})=>Object.assign(document.createElement(tag),props);
  const clock=seconds=>Math.floor(seconds/data.secondsPerMinute)+':'+String(Math.floor(seconds%data.secondsPerMinute)).padStart(2,'0');
  const sum=(ledger,read)=>Object.values(ledger).reduce((total,entry)=>total+read(entry),0);
  const factValue={
    time:state=>clock(state.time),combo:state=>String(state.hitsPeak),bossHP:state=>state.battleEnd.result.hp+'/'+state.battleEnd.result.maxHP,
    teamDamage:state=>String(sum(state.fightStats,root.LoftRumbleStats.total)),throws:state=>String(sum(state.fightStats,entry=>entry.throws)),
  };
  // Time, combo, replay and back keep the labels they had before this screen; newer keys live under copy.summary/actions.
  const facts=(state,keys)=>keys.map(key=>({key,label:copy.summary[key]??copy[key],value:factValue[key](state)}));
  const actions=keys=>keys.map((key,index)=>({key,label:copy.actions[key]??copy[key],primary:index===0}));
  // Descriptor callers supply provenance explicitly. String callbacks retain the original helper contract.
  function looks(ids,names,rosterArt){
    let custom=0;
    return Object.fromEntries(ids.map(id=>{
      const source=rosterArt(id),descriptor=typeof source==='object'&&source!==null;
      const candidates=descriptor?[source.canonical]:[id,String(names[id]??'').toLowerCase()];
      const known=candidates.find(key=>Object.hasOwn(look.art,key));
      const colour=look.colour[known]??look.palette[custom++%look.palette.length];
      return [id,{art:known?look.art[known]:descriptor?source.src:source,colour}];
    }));
  }
  // Stage slots by team size; a team bigger than the table spreads evenly at the crowd size.
  const placements=count=>look.stage[count]?.map(slot=>({...slot}))
    ??Array.from({length:count},(_,index)=>({x:(index+look.slotMidpoint)/count,size:look.crowdSize,tilt:0,back:0}));
  function rosterArt(id){
    const card=document.querySelector(`[data-resident="${id}"]`),image=card?.querySelector('.portrait img');
    const src=image?.src??'';
    const canonical=src&&!card.hasAttribute('data-own-art')
      &&(src===originalRoster?.[id]||src===image.dataset.hudPortraitSource);
    return {src,canonical:canonical?look.originalRoster[id]:undefined};
  }
  function renderStage(state){
    const ids=Object.keys(state.fightStats),art=looks(ids,residentNames,rosterArt),slots=placements(ids.length);
    document.querySelector('#demo-results .results-stage').replaceChildren(...ids.map((id,index)=>{
      const figure=make('span',{className:'results-figure'}),slot=slots[index];figure.dataset.figure=id; // not data-resident: the page's roster() treats those as hero cards
      for(const [name,value] of Object.entries({x:slot.x,size:slot.size,tilt:slot.tilt+'deg',back:slot.back,delay:index,layer:slot.back?1:2}))
        figure.style.setProperty('--'+name,String(value));
      figure.append(make('img',{src:art[id].art,alt:''}));
      return figure;
    }));
    return art;
  }
  function renderSummary(state){
    const list=document.getElementById('demo-summary'),items=facts(state,look.summary);
    const boss=document.querySelector('#demo-results .results-boss');
    if(state.battleEnd.result.won)boss.replaceChildren();
    else{
      if(!boss.children.length)boss.append(make('span',{textContent:copy.boss}),make('span',{id:'demo-bossHP'}));
      document.getElementById('demo-bossHP').textContent=factValue.bossHP(state);
    }
    fillSummary(list,items);
  }
  // The summary list for any set of facts {key,label,value}: updated in place when the keys match, else rebuilt.
  function fillSummary(list,items){
    if(list.children.length===items.length&&items.every(item=>document.getElementById('demo-'+item.key))){
      for(const item of items)document.getElementById('demo-'+item.key).textContent=item.value;
      return;
    }
    list.replaceChildren(...items.map(item=>{
      const line=make('div');
      line.append(make('dt',{id:`demo-${item.key}-label`,textContent:item.label}),make('dd',{id:'demo-'+item.key,textContent:item.value}));
      return line;
    }));
    document.getElementById('demo-replay').setAttribute('aria-describedby',
      ['demo-result-title','demo-result-hint',...items.flatMap(item=>[`demo-${item.key}-label`,'demo-'+item.key])].join(' '));
  }
  function breakdownRows(entry){
    const stats=root.LoftRumbleStats,rows=stats.breakdown(entry).map(part=>{
      const value=make('dd'),amount=make('span',{textContent:String(part.damage)});amount.dataset.partDamage='';value.append(amount);
      value.append(make('span',{className:'damage-count',textContent:part.count===null?'':copy.hitMark+part.count}));
      const label=make('dt',{textContent:copy.parts[part.key]}),note=copy.partNotes[part.key];
      if(note){const small=make('small',{className:'results-note',textContent:note});small.dataset.partNote=part.key;label.append(small);}
      return [label,value];
    });
    const lines=rows.map(pair=>{const line=make('div');line.append(...pair);return line;});
    // Teammates bumped is a count, not damage, so it sits in its own subsection under the damage parts.
    const setOff=make('div',{className:'results-setoff'});
    setOff.append(make('dt',{textContent:copy.setOff}),make('dd',{className:'damage-count',textContent:copy.hitMark+entry.setOff}));
    return [...lines,setOff];
  }
  function toggleBreakdown(state,id,button){
    const list=document.getElementById('demo-damage-list'),breakdown=document.getElementById('demo-breakdown');
    const opening=button.getAttribute('aria-expanded')!=='true';
    for(const row of list.querySelectorAll('[data-damage-row]'))row.setAttribute('aria-expanded','false');
    breakdown.hidden=!opening;
    if(!opening)return;
    breakdown.replaceChildren(...breakdownRows(state.fightStats[id]));
    button.after(breakdown);button.setAttribute('aria-expanded','true');
  }
  // Throws, specials and bumps under the name, so a supporter's share shows without opening the row.
  function rowCounts(entry){
    const line=make('span',{className:'damage-counts'});
    Object.entries(root.LoftRumbleStats.counts(entry)).forEach(([key,value],index)=>{
      const count=make('span',{textContent:copy.rowCounts[key]+' '+value});count.dataset.count=key;
      if(index)line.append(copy.countSeparator);
      line.append(count);
    });
    return line;
  }
  function heroRow(state,row,art){
    const item=make('li',{className:'results-hero'}),button=make('button',{type:'button',className:'damage-row'});
    item.dataset.colour=art.colour;
    button.dataset.damageRow=row.id;button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','demo-breakdown');
    const total=make('span',{className:'damage-total',textContent:String(row.total)});total.dataset.damageTotal='';
    const bar=make('span',{className:'damage-bar'});bar.setAttribute('aria-hidden','true');bar.style.setProperty('--fill',String(row.fill));
    const chevron=make('span',{className:'results-chevron'});chevron.setAttribute('aria-hidden','true');
    button.append(make('img',{src:art.art,alt:'',className:'damage-face'}),make('span',{className:'damage-name',textContent:residentNames[row.id]??row.id}),
      total,chevron,rowCounts(state.fightStats[row.id]),bar);
    button.addEventListener('click',()=>toggleBreakdown(state,row.id,button));
    item.append(button);return item;
  }
  function renderDamage(state,art){
    const list=document.getElementById('demo-damage-list'),breakdown=document.getElementById('demo-breakdown');
    breakdown.hidden=true;document.getElementById('demo-damage').append(breakdown);
    const ids=Object.keys(state.fightStats);
    list.replaceChildren(...root.LoftRumbleStats.board(state.fightStats,ids).map(row=>heroRow(state,row,art[row.id])));
  }
  const actionRun={
    back:()=>{const loft=new URL('../../',location.href);loft.searchParams.set('from','rumble');location.assign(loft.href);},
    tutorial:()=>document.getElementById('replay-tutorial').click(),
  };
  function buildActions(replay){
    const footer=make('div',{className:'results-actions'});
    for(const action of actions(look.actions)){
      const button=action.key==='replay'?replay:make('button',{type:'button'});
      button.replaceChildren(make('span',{className:'results-action-label',textContent:action.label}));button.dataset.action=action.key;
      button.classList.add(action.primary?'results-primary':'results-secondary');
      if(button!==replay)button.addEventListener('click',actionRun[action.key]);
      footer.append(button);
    }
    return footer;
  }
  // A dedicated scene: pinned celebration and summary, scrolling damage, fixed actions.
  function buildResults(){
    const panel=document.getElementById('demo-results'),replay=document.getElementById('demo-replay');
    const summary=panel.querySelector(':scope > dl');summary.id='demo-summary';summary.className='results-summary';
    summary.replaceChildren(); // renderSummary builds its items from results.summary
    const stage=make('div',{className:'results-stage'});stage.setAttribute('aria-hidden','true');
    stage.style.setProperty('--ground',String(look.ground));stage.style.setProperty('--foot',String(look.footPad));
    const head=make('header',{className:'results-head'});head.append(document.getElementById('demo-result-title'),stage);
    const divider=make('span',{className:'results-divider'});divider.setAttribute('aria-hidden','true');
    const damage=make('section',{id:'demo-damage'});damage.setAttribute('aria-labelledby','demo-damage-title');
    damage.append(make('h3',{id:'demo-damage-title',textContent:copy.damage}),make('ul',{id:'demo-damage-list'}),make('dl',{id:'demo-breakdown',hidden:true}));
    const body=make('div',{className:'results-body'});
    body.append(damage);
    const celebration=make('div',{className:'results-celebration'});
    celebration.append(head,document.getElementById('demo-result-hint'),summary,divider);
    const crest=make('span',{className:'results-crest'});crest.setAttribute('aria-hidden','true');
    const surface=make('div',{className:'results-surface'});
    surface.append(crest,celebration,body,buildActions(replay));
    const boss=make('div',{className:'results-boss'});
    panel.replaceChildren(boss,surface);
  }
  // A swarm fight reaches here without the demo install while it is lab-only (SWARM_LIVE false): build the results kit once
  // and wire its replay to the page's again().
  // The page's reset() presents at boot with no `again`, so the kit is built before one exists: the click reads the latest one.
  let swarmAgain;
  function swarmKit(again){
    swarmAgain=again??swarmAgain;
    if(document.getElementById('demo-summary'))return;
    buildResults();
    document.getElementById('demo-replay').addEventListener('click',()=>swarmAgain?.());
  }
  function present(state,ready,again){
    if(!active(state)&&!state.swarm)return;
    if(!active(state))swarmKit(again);
    const panel=document.getElementById('demo-results'),wasHidden=panel.hidden;
    // Called every frame: write only on change, so an unchanged panel costs no style invalidation.
    if(wasHidden!==!ready)panel.hidden=!ready;
    for(const chrome of document.querySelectorAll('.top,.roster'))if(chrome.inert!==ready)chrome.inert=ready;
    const stageLabel=state.demo&&document.getElementById('stage-label'),stageText=state.demo?.enraged?copy.enragedBoss:copy.boss;
    if(stageLabel&&stageLabel.textContent!==stageText)stageLabel.textContent=stageText;
    if(!ready)return;
    const result=state.battleEnd.result,swarm=state.swarm?swarmEnd(state.swarm.model):null; // a swarm fight shows its own facts (swarmEnd), no damage list
    panel.dataset.outcome=swarm?swarm.outcome:result.won?'victory':'defeat';panel.toggleAttribute('data-swarm',!!swarm); // swarm-only layout (rumble-demo.css)
    document.getElementById('demo-result-title').textContent=swarm?swarm.title:result.won?copy.victory:copy.defeat;
    document.getElementById('demo-result-hint').textContent=swarm?'':result.won?copy.winHint:copy.lossHint;
    panel.querySelector('#demo-damage').hidden=!!swarm;
    if(swarm)panel.dataset.swarmMode=swarm.mode;else delete panel.dataset.swarmMode; // defense styles its kill count (rumble-demo.css)
    if(swarm){panel.querySelector('.results-boss').replaceChildren();fillSummary(document.getElementById('demo-summary'),swarm.facts)}
    else renderSummary(state);
    if(wasHidden&&!swarm)renderDamage(state,renderStage(state));
    const surface=panel.querySelector('.results-surface'),body=panel.querySelector('.results-body');
    const celebration=panel.querySelector('.results-celebration');
    const compactVictory=result.won&&getComputedStyle(panel).getPropertyValue('--lm-scroll-celebration').trim()==='1';
    panel.toggleAttribute('data-compact-victory',compactVictory);
    if((!result.won||compactVictory)&&celebration.parentElement!==body)body.prepend(celebration);
    if(result.won&&!compactVictory&&celebration.parentElement!==surface)surface.insertBefore(celebration,body);
    if(!result.won){
      const style=getComputedStyle(surface);
      const natural=[...surface.children].filter(child=>!child.classList.contains('results-crest'))
        .reduce((height,child)=>height+child.scrollHeight,0)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
      const available=Math.min(panel.clientHeight,innerHeight)-parseFloat(getComputedStyle(panel).getPropertyValue('--lm-defeat-clearance'));
      panel.style.setProperty('--lm-defeat-height',Math.min(natural,available)+'px');
    }
    if(!wasHidden)return;
    panel.querySelector('.results-body').scrollTop=0;
    document.getElementById('demo-replay').focus({preventScroll:true});
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
  // The demo's third hero is Puff, unless a saved team (keep) already named it (#443 B3a).
  function nameResident({names,doc,keep}){
    if(keep)return;
    names.custom=data.resident.name;
    doc.querySelector('[data-resident="custom"] b').textContent=data.resident.name;
  }
  function install({s,names,reset:restart,again,draw,ready,keep=false}){
    if(root.LoftRumbleLabPolicy.allowed(location,document.documentElement))return;
    rememberRoster();
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
    nameResident({names,doc:document,keep});
    for(const child of document.getElementById('menu').children){
      if(!data.playerControls.includes(child.id))child.hidden=true;
    }
    const brand=document.createElement('div');brand.className='pause-brand';
    const logo=document.createElement('img');logo.src='art/rumble-logo.webp';logo.alt='';
    brand.append(logo);
    const title=document.createElement('h2');title.id='pause-title';title.textContent=copy.pausedTitle;
    menu.setAttribute('aria-labelledby',title.id);
    menu.prepend(brand,title);
    menu.append(pause,document.getElementById('sound'),document.getElementById('music'),document.getElementById('music-track-row'),document.getElementById('haptics'),document.getElementById('throw-style'),help,document.getElementById('replay-tutorial'),document.getElementById('reset'));
    const helpPanel=document.getElementById('help-panel'),helpTitle=document.createElement('h2');
    helpTitle.id='battle-help-title';helpTitle.textContent=copy.helpMenu;helpTitle.tabIndex=-1;helpTitle.autofocus=true;
    const helpBody=document.createElement('div');helpBody.className='help-body';
    helpBody.id='battle-help-body';helpBody.tabIndex=0;helpBody.setAttribute('role','region');
    helpBody.setAttribute('aria-labelledby',helpTitle.id);
    helpBody.append(...helpPanel.childNodes);
    helpPanel.setAttribute('aria-labelledby',helpTitle.id);helpPanel.append(helpTitle,helpBody);
    const helpClose=document.createElement('button');helpClose.className='help-resume';helpClose.textContent=copy.resume;
    const helpFooter=document.createElement('div');helpFooter.className='help-footer';
    helpClose.onclick=()=>help.click();helpFooter.append(helpClose);helpPanel.append(helpFooter);
    residentNames=names;buildResults();
    const replay=document.getElementById('demo-replay');
    replay.addEventListener('click',()=>{(again||restart)();draw();document.getElementById('menu-toggle').focus({preventScroll:true})});
    restart();draw();
    const cinematic=root.LoftRumbleCinematic.play({main:document.querySelector('main'),setBlocked:on=>{s.cinematic=on}});
    reveal(ready,draw,cinematic);
  }
  // ---- Swarm end screen (ledger #487): pure data from a SwarmState; Bramble's present() is untouched. ----
  const swarmResult=state=>({mode:state.mode,won:state.outcome==='won',kills:state.kills,seconds:state.t});
  function swarmEnd(state){
    const result=swarmResult(state),words=copy.swarm;
    const kills={key:'kills',label:words.kills,value:String(result.kills)},time={key:'time',label:words.time,value:clock(result.seconds)};
    const outcome=result.won?'victory':'defeat';
    if(result.mode==='defense')return defenseEnd(state,result,kills,outcome);
    // Hold is won by time, so the time held leads; Hunt is won by kills (U6: a Hold loss led with "Kills 0").
    return {mode:result.mode,outcome,title:result.won?words.won:words.lost,facts:result.mode==='hold'?[time,kills]:[kills,time]};
  }
  // Defense (D2): kills are the score and lead; then the waves held (progress().held: those whose every monster has died; all of them on a win);
  // and the bites the crystal took, read from the model's progress() so the card and the HUD agree.
  function defenseEnd(state,result,kills,outcome){
    const words=copy.swarm,p=root.LoftRumbleSwarm.progress(state),held=p.held;
    return {mode:'defense',outcome,title:result.won?words.won:words.defense.lost,facts:[kills,
      {key:'waves',label:words.defense.waves,value:held+'/'+p.waves},
      {key:'bites',label:words.defense.bites,value:String(p.bites)}]};
  }
  // clock is the one battle-time formatter (D5): it floors the elapsed seconds, and the page's header and end card call it.
  root.LoftRumbleDemo=Object.freeze({clock,active,reset,advance,rotation,interval,trackWarning,observeImpact,present,install,nameResident,
    swarm:Object.freeze({swarmResult,swarmEnd}),
    results:Object.freeze({facts,actions,looks,placements})});
})(globalThis);
