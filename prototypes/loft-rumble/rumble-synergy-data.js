(function(root){
  'use strict';
  // Synergy numbers (ledger #462, unit A1), one block per synergy, one numbers object per mode (docs/product/LOFT-RUMBLE-FLING-AND-SPECIALS.md,
  // "One set of mechanics, numbers per mode"). Only `boss` exists today; swarm and PvP add a key under `modes`.
  // The first three are copied from the page's inline `A` table (loft-rumble-realtime.html) with no change; A2 removes the page table.
  // The other eight are the owner's confirmed defaults, 2026-11-19. `ready` is true when the page runs the ability today; the
  // engine units (A2 projectiles, A3 fields, A4 heal and shield) flip it. Share fields are fractions (0.6 = 60%).
  // Real time: a fling touches each hero once and nothing shows a cooldown, so no block carries one.
  const SEED_BURST={
    damage:8,        // per bolt, fixed (prototype tuning, page `A.burstDamage`)
    count:3,         // bolts per activation (page `A.burstCount`)
    speed:540,       // bolt travel, px/s (page `A.boltSpeed`)
    stagger:.09,     // seconds between bolt releases (page abilityAt)
    boltLife:2,      // seconds before an unspent bolt expires (page abilityAt)
    waveRadius:60,   // the small ring shown at the ally on activation (page abilityAt)
  };
  const PIERCING_BEAM={damage:26}; // always hits the enemy (page `A.beamDamage`)
  const SHOCKWAVE={
    damage:36,       // fixed on contact when the enemy is inside the ring (page `A.shockDamage`)
    range:230,       // ring radius, px, plus the enemy radius (page `A.shockRange`)
  };
  const SPREAD_SHOT={
    count:3,         // seeds per burst (owner, 2026-11-19)
    angleDeg:30,     // total fan, degrees (owner, 2026-11-19)
    damageShare:.6,  // of one seed's damage (owner, 2026-11-19)
  };
  const RICOCHET={
    damageShare:.4,  // of the carrying hit's damage per bounce (owner, 2026-11-19)
    maxBounces:2,    // (owner, 2026-11-19)
  };
  const CHAIN_LIGHTNING={
    jumps:3,         // extra targets after the first (owner, 2026-11-19)
    damageShare:.3,  // of the carrying hit's damage per jump (owner, 2026-11-19)
  };
  const POISON_CLOUD={
    bossMaxHpShare:.01, // of the boss's max HP per second (owner, 2026-11-19)
    seconds:4,          // duration of one stack (owner, 2026-11-19)
    maxStacks:3,        // (owner, 2026-11-19)
  };
  const POWER_FIELD={
    seconds:4,       // how long the field stays (owner, 2026-11-19)
    damageBonus:.25, // added to the damage of heroes flung through it (owner, 2026-11-19)
  };
  const BOOSTER={
    speedBonus:.5,   // added to the speed of the hero who bumped it (owner, 2026-11-19)
    seconds:2,       // (owner, 2026-11-19)
  };
  const MEND={teamMaxHpShare:.03}; // healed into the shared team pool (owner, 2026-11-19)
  const BUBBLE_GUARD={hitsAbsorbed:1}; // on the bumper; absorbs one hit (owner, 2026-11-19)

  const entry=(ready,boss)=>Object.freeze({ready,modes:Object.freeze({boss:Object.freeze(boss)})});
  const synergies=Object.freeze({
    'seed-burst':entry(true,SEED_BURST),
    'piercing-beam':entry(true,PIERCING_BEAM),
    'shockwave':entry(true,SHOCKWAVE),
    'spread-shot':entry(true,SPREAD_SHOT),
    'ricochet':entry(true,RICOCHET),
    'chain-lightning':entry(true,CHAIN_LIGHTNING),
    'poison-cloud':entry(true,POISON_CLOUD),
    'power-field':entry(true,POWER_FIELD),
    'booster':entry(true,BOOSTER),
    'mend':entry(true,MEND),
    'bubble-guard':entry(true,BUBBLE_GUARD),
  });
  // The synergy each launch trait carries by default. A trait absent here has none.
  const defaultByTrait=Object.freeze({springy:'seed-burst',heavy:'shockwave',piercing:'piercing-beam'});
  const FALLBACK_MODE='boss'; // a mode with no numbers reads these
  const data=Object.freeze({synergies,defaultByTrait,fallbackMode:FALLBACK_MODE});
  root.LoftRumbleSynergyData=data;
  if(typeof module!=='undefined')module.exports=data;
})(typeof globalThis!=='undefined'?globalThis:this);
