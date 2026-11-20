(function(root){
  'use strict';
  // Loft Rumble's reader of the loft's roster snapshot (docs/architecture/ICD.md, loftio-rumble-roster-v1; docs/architecture/ROSTER.md).
  // A hand copy of game/src/loadout/roster-contract.ts: roster-reader.test.cjs runs one hostile-case table through both and
  // compares the trait list with loadout-data.ts, and its id-pattern cases pin the id pattern, so a drift fails the build. Pure: readTeam takes the stored value;
  // only fromStorage touches a store, and it is handed one. Never throws. Plain script, no DOM.
  const KEY='loftio-rumble-roster-v1';     // the contract's ROSTER_KEY
  const VERSION=1;                          // the contract's ROSTER_VERSION
  const MODES=Object.freeze(['mock','local','online']);
  const TRAITS=Object.freeze(['springy','heavy','piercing']);
  const ID_PATTERN=/^[a-z0-9-]{1,32}$/;      // the contract's ID_PATTERN (loadout-data.ts, ID_MAX_LENGTH 32)
  const ART_PREFIX='data:image/';           // the contract's ART_SRC_PREFIX: only an inline image is ever drawn
  // Bounds are Rumble's own (the contract has none): the team has three slots, and a hostile or huge snapshot must cost little.
  const MAX_TEAM=3;                         // three team slots (VISION.md)
  const MAX_SCAN=64;                        // entries examined; a valid resident past this is ignored
  const MAX_ID=80;
  const MAX_NAME=40;                        // fits the hero card name line
  const MAX_ART_SRC=400000;                 // a ~96px thumbnail data URL is a few KB; anything this size is not one
  const MAX_STORED=2000000;                 // characters of raw JSON fromStorage will parse

  const isObject=v=>typeof v==='object'&&v!==null&&!Array.isArray(v);
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k)?o[k]:undefined;   // never an inherited or __proto__ value
  const side=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
  const clip=(s,n)=>s.length>n?s.slice(0,n):s;
  const isId=v=>typeof v==='string'&&ID_PATTERN.test(v);

  // Contract parity: art must be a data-URL image with positive sides, else the resident is invalid.
  // Rumble-only: an oversized one is dropped to null, the resident stays.
  const readArt=a=>{
    if(a===null)return {ok:true,art:null};
    if(!isObject(a))return {ok:false};
    const src=own(a,'src'),width=own(a,'width'),height=own(a,'height');
    if(typeof src!=='string'||!src.startsWith(ART_PREFIX)||!side(width)||!side(height))return {ok:false};
    if(src.length>MAX_ART_SRC)return {ok:true,art:null};
    return {ok:true,art:Object.freeze({src,width,height})};
  };

  // Contract parity with parseLoadout. Synergy and special are ids, independent of the trait; an id this build does not know
  // is kept as given (a caller checks LoftRumbleSynergy.has). `names` is read only so a hostile getter drops the entry as in
  // the contract; Rumble does not use the pack, so it is not carried.
  const readLoadout=r=>{
    if(!isObject(r))return null;
    const trait=own(r,'trait'),synergy=own(r,'synergy'),special=own(r,'special');
    own(r,'names');
    if(own(r,'schemaVersion')!==1||typeof trait!=='string'||!TRAITS.includes(trait))return null;
    if(!isId(synergy)||(special!==null&&!isId(special)))return null;
    return Object.freeze({schemaVersion:1,trait,synergy,special});
  };

  // The element of a resident's loadout (rumble-elements-data.js IDS), or null: missing, non-string or unknown is neutral,
  // not a reason to drop the resident. Read at call time: the data file loads after this one. Rumble-only, not in the contract yet.
  const elementIds=()=>root.LoftRumbleElementsData?.IDS??[];
  const readElement=rumble=>{
    const e=isObject(rumble)?own(rumble,'element'):undefined;
    return typeof e==='string'&&elementIds().includes(e)?e:null;
  };

  const readResident=raw=>{
    if(!isObject(raw))return null;
    const id=own(raw,'id'),name=own(raw,'name'),kind=own(raw,'kind'),castId=own(raw,'castId');
    if(typeof id!=='string'||typeof name!=='string'||typeof own(raw,'inRoom')!=='boolean')return null;
    if(kind!=='original'&&kind!=='made')return null;
    if(castId!==undefined&&typeof castId!=='string')return null;
    if(kind==='original'&&castId===undefined)return null;
    const rumble=own(raw,'rumble'),art=readArt(own(raw,'art')),loadout=readLoadout(rumble);
    if(!art.ok||loadout===null)return null;
    return Object.freeze({id:clip(id,MAX_ID),kind,name:clip(name,MAX_NAME),art:art.art,
      trait:loadout.trait,loadout,synergy:loadout.synergy,element:readElement(rumble)});
  };

  // The player's team (at most MAX_TEAM valid residents, snapshot order, first of a duplicate id), or null so the caller
  // uses the demo trio: wrong or missing snapshot, or no valid resident in it.
  const readTeam=value=>{
    try{
      if(!isObject(value)||own(value,'version')!==VERSION)return null;
      const writtenAt=own(value,'writtenAt'),residents=own(value,'residents');
      if(!MODES.includes(own(value,'mode'))||typeof writtenAt!=='number'||!Number.isFinite(writtenAt)||!Array.isArray(residents))return null;
      const team=[],seen=new Set();
      const scan=Math.min(residents.length,MAX_SCAN);
      for(let i=0;i<scan&&team.length<MAX_TEAM;i++){
        let one=null;
        try{one=readResident(residents[i]);}catch(e){one=null;}   // a hostile getter drops that entry only
        if(one===null||seen.has(one.id))continue;
        seen.add(one.id);team.push(one);
      }
      return team.length?Object.freeze(team):null;
    }catch(e){return null;}
  };

  // `store` is a Storage-like with getItem (pass window.localStorage). Missing, broken or oversized values give null.
  const fromStorage=store=>{
    try{
      const raw=store.getItem(KEY);
      if(typeof raw!=='string'||raw.length>MAX_STORED)return null;
      return readTeam(JSON.parse(raw));
    }catch(e){return null;}
  };

  root.LoftRumbleRosterReader=Object.freeze({KEY,MAX_TEAM,traits:TRAITS,readTeam,fromStorage});
})(globalThis);
