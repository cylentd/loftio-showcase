(function(root){
  'use strict';
  /** @typedef {{phase:'active'|'holding'|'results', elapsed:number, at:number, result?:Readonly<{won:boolean,hp:number,maxHP:number}>}} BattleEndState */
  const initial=()=>({phase:'active',elapsed:0,at:0});
  // Owner's cinematic reading interval (ledger 419/420): visible, unpaused milliseconds.
  const HOLD_MS=3000;
  // Only data crosses the capture boundary. Every container is new and frozen;
  // unsupported values (including callbacks) are omitted rather than retained.
  function copyVisual(value){
    if(value===null||['string','boolean','number'].includes(typeof value))return value;
    if(Array.isArray(value))return Object.freeze(value.map(copyVisual));
    if(value&&typeof value==='object')return Object.freeze(Object.fromEntries(
      Object.entries(value).filter(([,item])=>typeof item!=='function'&&typeof item!=='undefined')
        .map(([key,item])=>[key,copyVisual(item)])));
    return null;
  }
  function next(state,event){
    if(event.type==='reset')return initial();
    if(event.type==='terminal'&&state.phase==='active'){
      const holding={phase:'holding',elapsed:0,at:event.now};
      if(event.result)holding.result=Object.freeze({won:event.result.won,hp:event.result.hp,maxHP:event.result.maxHP});
      if(event.result?.presentation)holding.presentation=copyVisual(event.result.presentation);
      return holding;
    }
    if(event.type!=='frame'||state.phase!=='holding')return state;
    const elapsed=Math.min(HOLD_MS,state.elapsed+(event.running?Math.max(0,event.now-state.at):0));
    return {...state,phase:elapsed>=HOLD_MS?'results':'holding',elapsed,at:event.now};
  }
  const terminal=(state,now,result)=>next(state,{type:'terminal',now,result});
  const frame=(state,now,running)=>next(state,{type:'frame',now,running});
  const ready=state=>state.phase==='results';
  const presenting=state=>state?.phase==='holding'&&!!state.presentation;
  root.LoftRumbleBattleEnd=Object.freeze({initial,next,terminal,frame,ready,presenting});
})(globalThis);
