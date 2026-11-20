(function(root){
  'use strict';
  // Synergy registry reader (ledger #462, unit A1). Data only: ids and per-mode numbers (rumble-synergy-data.js), names and
  // descriptions (rumble-synergy-copy.js). No engine, no visuals: projectiles, fields, heal and shield are units A2-A4.
  // Every reader tolerates an unknown, null or odd id (a saved roster may name a synergy this build lacks) and never throws.
  const D=root.LoftRumbleSynergyData,COPY=root.LoftRumbleSynergyCopy;
  const own=(table,id)=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(table,id)?table[id]:null;
  const entry=id=>own(D.synergies,id);
  const ids=()=>Object.keys(D.synergies);
  const has=id=>entry(id)!==null;
  const name=id=>has(id)?own(COPY.name,id):null;
  const description=id=>has(id)?own(COPY.description,id):null;
  // Numbers for one mode; a mode with none reads the fallback mode. Frozen, so a caller cannot change a default.
  function numbers(id,mode){const e=entry(id);return e?(own(e.modes,mode)??e.modes[D.fallbackMode]):null}
  const ready=id=>entry(id)?.ready===true;
  const roster=list=>Array.isArray(list)?list.filter(has):[];
  const defaultFor=trait=>own(D.defaultByTrait,trait);
  const api=Object.freeze({ids,has,name,description,numbers,ready,roster,defaultFor});
  root.LoftRumbleSynergy=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
