(function(root){
  'use strict';
  // Display names and one-line descriptions of synergies, keyed by synergy id (architecture.md, "Copy is data").
  // A test keeps the three launch names equal to the page's per-trait ability names in rumble-demo-data.js.
  const name={
    'seed-burst':'Seed burst','piercing-beam':'Piercing beam','shockwave':'Shockwave',
    'spread-shot':'Spread shot','ricochet':'Ricochet','chain-lightning':'Chain lightning','poison-cloud':'Poison cloud',
    'power-field':'Power field','booster':'Booster','mend':'Mend','bubble-guard':'Bubble guard',
  };
  const description={
    'seed-burst':'Fires seeds at the boss.',
    'piercing-beam':'A beam that always hits the boss.',
    'shockwave':'A ring that hurts the boss if it is close.',
    'spread-shot':'Three seeds fan out toward the boss.',
    'ricochet':'The seed bounces on to hit again.',
    'chain-lightning':'Lightning jumps between targets.',
    'poison-cloud':'A cloud that wears the boss down. It stacks.',
    'power-field':'Heroes flung through it hit harder.',
    'booster':'Speeds up the hero who bumped it.',
    'mend':'Heals the whole team.',
    'bubble-guard':'Blocks the next hit on the hero who bumped it.',
  };
  const copy=Object.freeze({name:Object.freeze(name),description:Object.freeze(description)});
  root.LoftRumbleSynergyCopy=copy;
  if(typeof module!=='undefined')module.exports=copy;
})(typeof globalThis!=='undefined'?globalThis:this);
