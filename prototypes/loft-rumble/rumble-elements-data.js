(function(root){
  'use strict';
  // Element data (ledger #481). Decision by the conductor 2026-11-20, owner to confirm: change a number here, nowhere else.
  const IDS=Object.freeze(['bloom','splash','ember','spark','chaos']);
  // BEATS[a] is the element a beats. Bloom > splash > ember > bloom is a cycle; spark and chaos beat each other.
  const BEATS=Object.freeze({bloom:'splash',splash:'ember',ember:'bloom',spark:'chaos',chaos:'spark'});
  const ELEMENT_ADVANTAGE=1.5;      // attacker beats defender (decision above)
  const ELEMENT_DISADVANTAGE=.75;   // defender beats attacker (decision above)
  const NEUTRAL=1;                  // same element, no relation, or a missing or unknown element
  const BOSS_ELEMENT='bloom';       // Bramble, the boss (decision above)
  // Off until the owner sees an element cue, so play is unchanged (brief #481).
  const ELEMENTS_LIVE=false;
  root.LoftRumbleElementsData=Object.freeze({IDS,BEATS,ELEMENT_ADVANTAGE,ELEMENT_DISADVANTAGE,NEUTRAL,BOSS_ELEMENT,ELEMENTS_LIVE});
})(typeof globalThis!=='undefined'?globalThis:this);
