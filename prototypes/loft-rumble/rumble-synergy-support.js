(function(root){
  'use strict';
  // Support synergies in real time (ledger #462, unit A4): Mend and Bubble guard. Pure functions, no page state.
  // Every number comes from the registry (rumble-synergy.js) and is passed in as `n`. Mend heals the shared team pool; a bubble sits
  // on the bumper (the hero who made the contact) and absorbs hits, a hero holding at most one. The page owns the bubbles record.
  const MEND='mend',BUBBLE='bubble-guard';
  const HANDLES=Object.freeze([MEND,BUBBLE]);
  const MIN_HEAL=1; // a heal always lands at least one point, like a poison tick (A3)

  // New team HP after a Mend: the share of team max HP, capped at the max. A fallen team (0 or less) stays fallen.
  function mend(teamHp,teamMax,n){
    if(teamHp<=0)return teamHp;
    return Math.min(teamMax,teamHp+Math.max(MIN_HEAL,Math.round(teamMax*n.teamMaxHpShare)));
  }

  // bubbles maps hero id to hits left. A hero already holding one keeps it as is. Returns a new record.
  function grantBubble(bubbles,heroId,n){
    if(bubbles[heroId]>0)return {...bubbles};
    return {...bubbles,[heroId]:n.hitsAbsorbed};
  }

  // One boss hit on heroId. Returns whether a bubble took it and the new record; a spent bubble is removed.
  function absorb(bubbles,heroId){
    if(!(bubbles[heroId]>0))return {absorbed:false,bubbles:{...bubbles}};
    const {[heroId]:left,...rest}=bubbles;
    return {absorbed:true,bubbles:left-1>0?{...rest,[heroId]:left-1}:rest};
  }

  const api=Object.freeze({handles:HANDLES,ids:Object.freeze({mend:MEND,bubble:BUBBLE}),mend,grantBubble,absorb});
  root.LoftRumbleSynergySupport=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
