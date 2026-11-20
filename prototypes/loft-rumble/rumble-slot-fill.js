(function(root){
  'use strict';
  // Team slot fill (ledger #443, unit B2). Pure: turns the roster reader's team into the page's hero slots, or the demo trio
  // when there is no snapshot. Synergy numbers are read only through LoftRumbleSynergy (the registry); no number or id list here.
  // A synergy the registry lacks, or has but does not run yet, falls back to the trait's default so the fight never breaks.
  // The roster special does not change the fight yet (specials engine, parked): slots keep the trait's one special.
  const SLOT_IDS=Object.freeze(['sprout','chomper','custom']);   // the page's fixed hero ids, in team order
  const D=()=>root.LoftRumbleDemoData;

  const slot=(syn,index,hero)=>{
    const usable=syn.has(hero.synergy)&&syn.ready(hero.synergy);
    const synergy=usable?hero.synergy:syn.defaultFor(hero.trait);
    return Object.freeze({id:SLOT_IDS[index],residentId:hero.id,name:hero.name,art:hero.art??null,trait:hero.trait,
      synergy,fellBack:!usable,numbers:syn.numbers(synergy)});
  };

  const demoHeroes=()=>{
    const page=D().copy.page,res=D().resident;
    return [{id:'sprout',name:page.name.sprout,trait:'springy'},{id:'chomper',name:page.name.chomper,trait:'heavy'},
      {id:'custom',name:res.name,trait:res.trait}].map(h=>({...h,synergy:null,art:null}));
  };

  // `team` is the reader's array (1 to 3 residents) or null for the demo trio.
  const fill=(team,syn=root.LoftRumbleSynergy)=>{
    const roster=Array.isArray(team)&&team.length>0;
    const heroes=roster?team.slice(0,SLOT_IDS.length):demoHeroes();
    return Object.freeze({source:roster?'roster':'demo',slots:Object.freeze(heroes.map((h,i)=>slot(syn,i,h)))});
  };

  const fromStorage=(store,syn)=>{
    let team=null;
    try{team=root.LoftRumbleRosterReader.fromStorage(store);}catch(e){team=null;}
    return fill(team,syn);
  };

  const api=Object.freeze({slotIds:SLOT_IDS,fill,fromStorage});
  root.LoftRumbleSlotFill=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
