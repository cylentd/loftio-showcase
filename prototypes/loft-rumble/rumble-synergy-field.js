(function(root){
  'use strict';
  // Field synergies in real time (ledger #462, unit A3): Poison cloud and Power field. Pure records, no page state.
  // Every number comes from the registry (rumble-synergy.js). A Poison cloud sits on the boss and ticks a share of the boss's max HP;
  // a Power field sits where the hero activated and raises the damage of a hero flung through it. The page owns the list.
  const SYN=root.LoftRumbleSynergy,MODE='boss';
  const POISON='poison-cloud',POWER='power-field';
  const HANDLES=Object.freeze([POISON,POWER]);
  const TICK_SECONDS=1;   // the registry share is "of the boss's max HP per second", so one tick a second
  const POWER_RADIUS=110; // px; the registry has no radius, so A3 picks about half the Shockwave ring (230) for owner review
  const EPSILON=1e-9;     // float slack so sixty 1/60 s steps still add up to one whole second
  const num=id=>SYN.numbers(id,MODE);

  // A field record, or null for any id that is not a field synergy.
  function place(id,origin,target){
    if(id===POISON){const n=num(id);return {id,x:target.x,y:target.y,life:n.seconds,max:n.seconds,clock:0}}
    if(id===POWER){const n=num(id);return {id,x:origin.x,y:origin.y,life:n.seconds,max:n.seconds,radius:POWER_RADIUS}}
    return null;
  }

  // Adds a record. Poison stacks up to the registry cap; at the cap the stack with least life left is refreshed. One Power field at a time.
  function add(fields,field){
    if(!field)return fields;
    const cap=field.id===POISON?num(POISON).maxStacks:1,same=fields.filter(f=>f.id===field.id),rest=fields.filter(f=>f.id!==field.id);
    if(same.length<cap)return [...fields,field];
    const oldest=same.reduce((a,b)=>b.life<a.life?b:a);
    return [...rest,...same.filter(f=>f!==oldest),field];
  }

  // Advances every field by dt. Returns the fields still alive, the poison ticks that fell due (the damage of each) and, in the same
  // order, the field each tick came from, so the page can credit the hero whose synergy it was.
  function step(fields,dt,bossMaxHp){
    const ticks=[],sources=[],alive=[];
    for(const f of fields){
      const g={...f},run=Math.min(dt,g.life);
      if(g.id===POISON){
        g.clock+=run;
        while(g.clock>=TICK_SECONDS-EPSILON){g.clock-=TICK_SECONDS;ticks.push(Math.max(1,Math.round(bossMaxHp*num(POISON).bossMaxHpShare*TICK_SECONDS)));sources.push(f)}
      }
      g.life-=dt;
      if(g.life>EPSILON)alive.push(g);
    }
    return {fields:alive,ticks,sources};
  }

  // Damage multiplier for a hero at pos: the Power field bonus when inside one, else 1. Fields never stack.
  function bonusFor(fields,pos){
    const inside=fields.some(f=>f.id===POWER&&Math.hypot(pos.x-f.x,pos.y-f.y)<=f.radius);
    return inside?1+num(POWER).damageBonus:1;
  }

  const api=Object.freeze({handles:HANDLES,powerRadius:POWER_RADIUS,place,add,step,bonusFor});
  root.LoftRumbleSynergyField=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
