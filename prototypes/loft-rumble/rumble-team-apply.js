(function(root){
  'use strict';
  // Team apply (ledger #443, unit B3a). Pure: turns window.rumbleTeam (rumble-slot-fill.js) into what the realtime page needs, so the
  // saved team drives the fight. Inactive (the page keeps its demo trio, third hero rerolls) when there is no team or the team is the
  // demo trio. A roster slot keeps its own trait; a slot whose synergy fell back already carries its trait's default synergy.
  // Art and portraits still follow the slot id (slot 1 draws as Sprout); only names, traits and synergies come from the team.
  const DEMO_IDS=Object.freeze(['sprout','chomper','custom']);
  const rules=(active,ids)=>({
    showsCard:id=>!active||ids.includes(id),
    rerollHidden:demo=>!!demo||active,
  });
  const INACTIVE=Object.freeze({active:false,ids:null,names:null,trait:null,synergy:undefined,...rules(false,DEMO_IDS)});

  // `pageKinds` is the page's trait ids; a slot trait outside it plays as the first one, so the fight never reads an unknown profile.
  const plan=(team,pageKinds)=>{
    if(!team||team.source!=='roster'||!Array.isArray(team.slots)||team.slots.length===0)return INACTIVE;
    const names={},trait={},synergy={},element={};
    for(const slot of team.slots){
      names[slot.id]=slot.name;
      element[slot.id]=slot.element;   // undefined when the slot has none (neutral); loftio #483 adds the roster field
      trait[slot.id]=pageKinds.includes(slot.trait)?slot.trait:pageKinds[0];
      synergy[slot.id]=slot.synergy;
    }
    const ids=team.slots.map(slot=>slot.id);
    return Object.freeze({active:true,ids,names,trait,synergy,element,...rules(true,ids)});
  };

  const api=Object.freeze({plan});
  root.LoftRumbleTeamApply=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
