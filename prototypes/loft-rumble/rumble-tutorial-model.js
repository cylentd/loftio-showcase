// Loft Rumble tutorial model: the lifecycle of the Training run as one pure function, next(state, event) -> state.
// No DOM, no battle state, no timers: the stage reads the result and does the work. A refused event returns the same
// object. Spec and transition table: docs/product/LOFT-RUMBLE-TUTORIAL.md and docs/architecture/STATE-MACHINES.md.
(function(root){
  'use strict';
  const STATUSES=Object.freeze(['off','running','done','skipped']);
  const BEATS=Object.freeze(['intro','sling','chain','weak','dodge','special','graduate']);
  const PHASES=Object.freeze(['show','try','cheer']);
  const EVENTS=Object.freeze(['start','skip','replay','grab','launch','hit','ally','impact','special','idle','cheerDone','reset']);
  // Owner spec 2026-11-13 (plan loftio-rumble-tutorial.md, "Weak (12 s)"): a body hit ends the weak beat after this many launches.
  const WEAK_FALLBACK_TRIES=3;
  // The beats a player acts in. Intro and graduate are shown, never tried.
  const LESSONS=Object.freeze(['sling','chain','weak','dodge','special']);
  // The dodge beat is paced by the Beam, not by the player's idle time: its freeze-frame ends on a grab, its try on an impact.
  const BEAM_PACED='dodge';

  const make=(status,beat,phase,tries)=>Object.freeze({status,beat,phase,tries});
  const INITIAL=make('off',BEATS[0],'show',0);
  const nextBeat=beat=>BEATS[BEATS.indexOf(beat)+1];
  const lesson=state=>state.status==='running'&&LESSONS.includes(state.beat);
  const restart=()=>make('running',BEATS[0],'show',0);

  // Does this event end the beat's try phase? The sling needs any hit on Bramble, the chain a teammate bump, the weak beat
  // a weak-spot hit (or a body hit once the fallback is reached), the dodge an escape and the special its effect landing.
  function exits(state,event){
    switch(state.beat){
      case 'sling':return event.type==='hit';
      case 'chain':return event.type==='ally';
      case 'weak':return event.type==='hit'&&(event.weak===true||state.tries>=WEAK_FALLBACK_TRIES);
      case 'dodge':return event.type==='impact'&&event.escaped===true;
      case 'special':return event.type==='special';
      default:return false;
    }
  }
  const cheer=state=>make('running',state.beat,'cheer',state.tries);
  const show=state=>make('running',state.beat,'show',state.tries);
  const attempt=state=>make('running',state.beat,'try',state.tries);

  function inShow(state,event){
    if(event.type==='grab')return attempt(state);
    if(event.type==='idle'&&state.beat!==BEAM_PACED)return attempt(state);
    return state;
  }
  function inTry(state,event){
    if(exits(state,event))return cheer(state);
    if(event.type==='impact'&&state.beat===BEAM_PACED)return show(state); // caught: no damage, staged again
    if(event.type==='launch')return make('running',state.beat,'try',state.tries+1);
    if(event.type==='idle'&&state.beat!==BEAM_PACED)return show(state);
    return state;
  }
  // The beats are in a fixed order; graduating is the cheer of the last one.
  function inCheer(state,event){
    if(event.type!=='cheerDone')return state;
    const upcoming=nextBeat(state.beat);
    return upcoming?make('running',upcoming,'show',0):make('done',state.beat,'cheer',0);
  }
  function inBeat(state,event){
    if(lesson(state))return {show:inShow,try:inTry,cheer:inCheer}[state.phase](state,event);
    // intro: one shown card, then the first lesson. graduate: a shown stamp, then the cheer, then done.
    if(state.beat===BEATS[0]){
      return state.phase==='show'&&event.type==='idle'?make('running',nextBeat(state.beat),'show',0):state;
    }
    if(state.phase==='show'&&event.type==='idle')return cheer(state);
    if(state.phase==='cheer')return inCheer(state,event);
    return state;
  }

  function next(state,input){
    const event=typeof input==='string'?{type:input}:input;
    if(!event||!EVENTS.includes(event.type))return state;
    if(event.type==='replay')return restart();
    if(event.type==='reset')return state.status==='off'?state:INITIAL;
    if(state.status==='off')return event.type==='start'?restart():state;
    if(state.status!=='running')return state;
    if(event.type==='skip')return make('skipped',state.beat,state.phase,state.tries);
    return inBeat(state,event);
  }

  root.LoftRumbleTutorialModel=Object.freeze({next,INITIAL,STATUSES,BEATS,PHASES,EVENTS,WEAK_FALLBACK_TRIES});
})(globalThis);
