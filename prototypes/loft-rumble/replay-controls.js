(function(root){
  'use strict';
  // Fight replay controls (on unless ?replay=0): a Watch replay button under Play Again on the end screen, and one slim playback bar at the
  // bottom of the arena. It drives window.LoftRumbleReplay (replay-runtime.js) and reads nothing of the fight itself.
  // While replaying, <html data-replay> hides the results scene and blocks board input (replay-controls.css).
  const FLAG='replay',OFF='0',SECONDS_PER_MINUTE=60,CLOCK_DIGITS=2,FAST=2,NORMAL=1;
  // On for everyone (owner, look #535, 2026-11-22); only ?replay=0 turns the controls off.
  const flagged=search=>new URLSearchParams(search).get(FLAG)!==OFF;
  const clock=t=>{const whole=Math.max(0,Math.floor(t));return Math.floor(whole/SECONDS_PER_MINUTE)+':'+String(whole%SECONDS_PER_MINUTE).padStart(CLOCK_DIGITS,'0')};
  // Space belongs to a focused control (a button presses, the scrub steps); only page-level Space toggles playback.
  const ownsSpace=target=>!!target&&(target.tagName==='BUTTON'||target.tagName==='INPUT');
  function make(doc,tag,props){const el=doc.createElement(tag);Object.assign(el,props);return el}
  function set(el,key,value){if(el[key]!==value)el[key]=value}
  function attr(el,key,value){if(el.getAttribute(key)!==value)el.setAttribute(key,value)}

  // `locks`: the page's help opener, disabled while replaying (help would pause and cover the replay).
  // `pauseStone`: the top bar's pause control (it opens the menu in the fight). While replaying it stays on screen and pauses and plays the replay, never the menu.
  // Its data-glyph is play while paused and pause while playing (rumble-hud.css); out of a replay `livePaused` says whether the fight is paused.
  function install({doc,api,results,actions,stage,copy,raf,locks=[],pauseStone=null,livePaused=()=>false}){
    const page=doc.documentElement;
    let speed=api.state().speed||NORMAL;
    const button=make(doc,'button',{type:'button',className:'results-secondary replay-open',textContent:copy.open,hidden:true});
    button.dataset.action='watch-replay';actions.append(button);
    const bar=make(doc,'div',{className:'replay-bar',hidden:true,tabIndex:-1});bar.setAttribute('role','group');bar.setAttribute('aria-label',copy.bar);
    const toggle=make(doc,'button',{type:'button',className:'replay-toggle'});
    const glyph=make(doc,'span',{className:'replay-glyph'});glyph.setAttribute('aria-hidden','true');toggle.append(glyph);
    const scrub=make(doc,'input',{type:'range',className:'replay-scrub'});
    scrub.setAttribute('min','0');scrub.setAttribute('step','any');scrub.setAttribute('aria-label',copy.scrub);
    const time=make(doc,'span',{className:'replay-time'});time.setAttribute('aria-hidden','true');
    const speedButton=make(doc,'button',{type:'button',className:'replay-speed'});speedButton.setAttribute('aria-label',copy.speedLabel);
    // A drawn close glyph keeps the one-row bar's scrub wide on a phone; the words stay the button's name.
    const back=make(doc,'button',{type:'button',className:'replay-back',title:copy.back});back.setAttribute('aria-label',copy.back);
    const cross=make(doc,'span',{className:'replay-glyph'});cross.dataset.glyph='close';cross.setAttribute('aria-hidden','true');back.append(cross);
    bar.append(toggle,scrub,time,speedButton,back);stage.append(bar);

    const replaying=()=>FLAG in page.dataset;
    let stoneName=null; // the stone's own name, read on entering the replay and given back on leaving
    function lock(on){
      for(const el of locks)set(el,'disabled',on);
      if(!pauseStone)return;
      if(on)stoneName=pauseStone.getAttribute('aria-label');else if(stoneName!==null)attr(pauseStone,'aria-label',stoneName);
    }
    function tick(){
      const st=api.state();
      // The runtime went idle by itself: a new battle began (reset), which dropped the recording. Take the controls down; nothing to restore.
      if(replaying()&&st.mode==='idle'){delete page.dataset[FLAG];bar.hidden=true;lock(false)}
      if(!replaying()){set(button,'hidden',!(!results.hidden&&st.mode==='idle'&&st.frames>0));if(pauseStone)set(pauseStone.dataset,'glyph',livePaused()?'play':'pause');return}
      const playing=st.mode==='playing',label=copy.time.replace('{now}',clock(st.t)).replace('{end}',clock(st.end));
      attr(toggle,'aria-label',playing?copy.pause:copy.play);glyph.dataset.glyph=playing?'pause':'play';
      if(pauseStone){attr(pauseStone,'aria-label',playing?copy.pause:copy.play);set(pauseStone.dataset,'glyph',playing?'pause':'play')}
      attr(scrub,'max',String(st.end));if(Number(scrub.value)!==st.t)scrub.value=String(st.t);attr(scrub,'aria-valuetext',label);
      set(time,'textContent',label);set(speedButton,'textContent',copy.speed.replace('{n}',String(speed)));
      attr(speedButton,'aria-pressed',String(speed===FAST));
    }
    function watch(){
      if(!api.start())return;
      page.dataset[FLAG]='';bar.hidden=false;lock(true);tick();toggle.focus({preventScroll:true});
    }
    function leave(){
      // The flag goes first: exit() redraws the end screen, and the results must be displayable before anything takes focus.
      delete page.dataset[FLAG];bar.hidden=true;lock(false);api.exit();tick();button.focus({preventScroll:true});
    }
    function playPause(){if(api.state().mode==='playing')api.pause();else api.start();tick()}
    button.addEventListener('click',watch);
    // Capture phase, so the page's own click handler (it opens the menu) never sees a tap that belonged to the replay.
    pauseStone?.addEventListener('click',event=>{if(!replaying())return;event.preventDefault();event.stopImmediatePropagation();playPause()},true);
    back.addEventListener('click',leave);
    toggle.addEventListener('click',playPause);
    speedButton.addEventListener('click',()=>{speed=speed===FAST?NORMAL:FAST;api.setSpeed(speed);tick()});
    scrub.addEventListener('input',()=>{api.seek(Number(scrub.value));tick()});
    // After a drag the scrub would keep Space (it steps the slider); the bar takes focus so Space plays and pauses. Keyboard steps fire no pointerup.
    scrub.addEventListener('pointerup',()=>bar.focus({preventScroll:true}));
    // Capture phase, so the page's own Escape (menu, help) never sees a key that belonged to the replay.
    doc.addEventListener('keydown',event=>{
      if(!replaying())return;
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();leave();return}
      if(event.key===' '&&!ownsSpace(event.target)){event.preventDefault();playPause()}
    },true);
    const loop=()=>{tick();raf(loop)};raf(loop);
    return {tick,button,bar,toggle,scrub,time,speed:speedButton,back};
  }

  // The page boots with every script parsed: the runtime has attached and the results kit is built.
  function boot(){
    const doc=root.document,api=root.LoftRumbleReplay;
    const results=doc.getElementById('demo-results'),actions=results?.querySelector('.results-actions'),stage=doc.getElementById('arena');
    if(!api||!actions||!stage)return;
    const locks=['help-toggle'].map(id=>doc.getElementById(id)).filter(Boolean),pauseStone=doc.getElementById('menu-toggle');
    // The runtime's own paused state, so help and cinematic pauses show play too, not only the `#pause` button's aria-pressed (#624).
    install({doc,api,results,actions,stage,locks,pauseStone,livePaused:()=>api.paused(),copy:root.LoftRumbleDemoData.copy.watch,raf:fn=>root.requestAnimationFrame(fn)});
  }
  if(root.document&&flagged(root.location.search)){
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot);else boot();
  }
  root.LoftRumbleReplayControls=Object.freeze({install,flagged,clock});
})(globalThis);
