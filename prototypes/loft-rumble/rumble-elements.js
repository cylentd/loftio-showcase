(function(root){
  'use strict';
  // Element multiplier (ledger #481). Pure: a hero's element against the enemy's gives a damage factor. Applies to hero damage on
  // the enemy only; the team HP pool is not touched. All numbers and ids come from rumble-elements-data.js.
  const D=root.LoftRumbleElementsData;
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k)?o[k]:undefined;   // never an inherited or __proto__ value
  const known=e=>typeof e==='string'&&D.IDS.includes(e);

  // attacker's damage multiplier against defender; a missing or unknown element on either side is neutral.
  const elementMultiplier=(attacker,defender)=>{
    if(!known(attacker)||!known(defender))return D.NEUTRAL;
    if(own(D.BEATS,attacker)===defender)return D.ELEMENT_ADVANTAGE;
    if(own(D.BEATS,defender)===attacker)return D.ELEMENT_DISADVANTAGE;
    return D.NEUTRAL;
  };

  // The element on a roster hero: the top-level element that roster-reader.js sets from rumble.element. Undefined when absent or unknown.
  const heroElement=hero=>{
    if(typeof hero!=='object'||hero===null)return undefined;
    const e=own(hero,'element');
    return known(e)?e:undefined;
  };

  // The factor the page multiplies into a hero hit on the enemy. 1 while the flag is off.
  const damageFactor=(element,{live=D.ELEMENTS_LIVE,enemy=D.BOSS_ELEMENT}={})=>live?elementMultiplier(element,enemy):D.NEUTRAL;

  const api=Object.freeze({ids:D.IDS,bossElement:D.BOSS_ELEMENT,live:D.ELEMENTS_LIVE,elementMultiplier,heroElement,damageFactor});
  root.LoftRumbleElements=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
