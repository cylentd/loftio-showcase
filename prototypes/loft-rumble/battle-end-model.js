(function(root){
  'use strict';
  /** @typedef {{phase:'active'|'holding'|'results', elapsed:number, at:number, result?:Readonly<{won:boolean,hp:number,maxHP:number}>}} BattleEndState */
  const initial=()=>({phase:'active',elapsed:0,at:0});
  // Owner's battle-end reading interval (ledger 383): visible, unpaused milliseconds.
  const HOLD_MS=1500;
  function next(state,event){
    if(event.type==='reset')return initial();
    if(event.type==='terminal'&&state.phase==='active'){
      const holding={phase:'holding',elapsed:0,at:event.now};
      if(event.result)holding.result=Object.freeze({won:event.result.won,hp:event.result.hp,maxHP:event.result.maxHP});
      return holding;
    }
    if(event.type!=='frame'||state.phase!=='holding')return state;
    const elapsed=Math.min(HOLD_MS,state.elapsed+(event.running?Math.max(0,event.now-state.at):0));
    return {...state,phase:elapsed>=HOLD_MS?'results':'holding',elapsed,at:event.now};
  }
  const terminal=(state,now,result)=>next(state,{type:'terminal',now,result});
  const frame=(state,now,running)=>next(state,{type:'frame',now,running});
  const ready=state=>state.phase==='results';
  root.LoftRumbleBattleEnd=Object.freeze({initial,next,terminal,frame,ready});
})(globalThis);
