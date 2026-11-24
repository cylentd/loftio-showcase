// Tap-to-fire specials: every number (#536, docs/product/LOFT-RUMBLE-FLING-AND-SPECIALS.md, sections 2, 4 and 6).
// Source of every default below: "#536 plan defaults, 2026-11-21, owner may overrule". Page wiring is a later unit.
(function(root){
  // Tap gesture: a press that moves less than this and is held no longer than this counts as a tap, not a drag.
  const TAP_MAX_MOVE_PX=10;
  const TAP_MAX_HOLD_S=0.3;
  // Buckets (spec section 6): buffs of one kind take the max, buckets multiply.
  const BUCKET_BOOST='boost';
  const BUCKET_SPEED='speed';
  // Meteor: a Big Hit. Leaps to the nearest enemy, one burst around the landing spot.
  const METEOR_BOSS_DAMAGE=150;   // damage to each enemy in range, boss fight
  const METEOR_BOSS_RADIUS=150;   // px
  const METEOR_SWARM_DAMAGE=60;   // per monster
  const METEOR_SWARM_RADIUS=170;  // px
  const METEOR_ACTIVE_S=0.8;      // leap and slam time before the next special may start; owner-overrulable default, placeholder until the fx unit measures it
  // Picnic: a Team Boost. Spec section 4: heals and moves 30% faster for 6 s.
  const PICNIC_HEAL_FRACTION=0.15; // of team max HP
  const PICNIC_SPEED_MULT=1.3;
  const PICNIC_ACTIVE_S=6;
  // Big Plush: a Power-Up. Spec section 4: puffs up for 5 s, bigger hits.
  const BIG_PLUSH_SIZE=1.5;        // scales the sprite and its collider
  const BIG_PLUSH_DAMAGE_MULT=1.5; // Boost bucket
  const BIG_PLUSH_ACTIVE_S=5;
  const FALLBACK_SPECIAL='picnic'; // an unknown trait reads this
  const SETTING_KEY='loftRumbleSpecials'; // localStorage, same shape as loftRumbleThrow
  const SETTING_MODES=Object.freeze(['tap','auto']);
  const SETTING_FALLBACK='tap';
  // Painted Meteor smash (ledger #462), behind ?specials-fx=paint. One painted still, animated with transforms.
  // The owner approved the look on 2026-11-21, so the still is a repo file (512 px webp made from the approved
  // 1024 px PNG), relative to the page like every art/ file. Timings: look-round defaults.
  const PAINT_FLAG='specials-fx';
  const PAINT_ON='paint';
  const PAINT_METEOR_SRC='art/fx-meteor-impact.webp';
  const PAINT_METEOR_MS=760;         // whole pop, turn and fade; just under METEOR_ACTIVE_S so it ends before the next special
  const PAINT_REDUCED_MS=900;        // reduced motion: the still holds this long, then goes
  const PAINT_POP_FROM=0.35;         // start scale, so the burst bursts out of the landing spot
  const PAINT_OVERSHOOT=1.12;        // peak scale at PAINT_PEAK_AT
  const PAINT_PEAK_AT=0.22;          // fraction of the time at the peak
  const PAINT_HOLD_AT=0.55;          // fraction of the time it settles at full size before fading
  const PAINT_FADE_TO=1.28;          // end scale while it fades
  const PAINT_TURN_DEG=18;           // total turn over the whole effect, start to end

  // On-field effects of a tapped special (#536 U2b), code-drawn in realtime-draw.js. Source of every number: "#536 U2b look defaults,
  // 2026-11-22, owner may overrule"; each life stays under its special's active time, so an effect ends before the next can start.
  const FX_PICNIC_S=1.2;          // heal burst: rings and plus marks, seconds
  const FX_PICNIC_REACH=150;      // units the ring grows from the caster
  const FX_PICNIC_MARKS=4;        // plus marks rising off each hero
  const FX_PICNIC_RISE=46;        // units a plus mark rises
  const FX_PICNIC_MARK=12;        // plus mark arm length
  const FX_METEOR_FALL_S=0.32;    // seconds the leap takes, from the hero's spot to the slam
  const FX_METEOR_LEAP=170;       // units above the ground at the top of the leap
  const FX_METEOR_GROW=0.45;      // extra hero size at the top of the leap (it is nearer the camera)
  const FX_METEOR_PRESS_AT=0.3;   // share of the burst the hero stays pressed flat on the target, then it is back where it stood
  const FX_METEOR_S=METEOR_ACTIVE_S-0.05; // fall plus burst, just inside the special's active time
  const FX_PLUSH_S=0.75;          // body slam, seconds
  const FX_PLUSH_REACH=120;       // units the shock rings grow from the hero's feet
  const FX_PLUSH_PUFFS=8;         // dust puffs thrown outward
  const FX_PLUSH_DROP=34;         // units the hero's shadow-blob lands from
  const FX_STILL_AT=0.45;         // reduced motion: the moment of each effect that stays on screen, as a fraction of its life
  const fx=Object.freeze({
    picnic:Object.freeze({life:FX_PICNIC_S,reach:FX_PICNIC_REACH,marks:FX_PICNIC_MARKS,rise:FX_PICNIC_RISE,mark:FX_PICNIC_MARK}),
    meteor:Object.freeze({life:FX_METEOR_S,fallS:FX_METEOR_FALL_S,leap:FX_METEOR_LEAP,grow:FX_METEOR_GROW,pressAt:FX_METEOR_PRESS_AT,reach:METEOR_BOSS_RADIUS}),
    bigPlush:Object.freeze({life:FX_PLUSH_S,reach:FX_PLUSH_REACH,puffs:FX_PLUSH_PUFFS,drop:FX_PLUSH_DROP}),
    stillAt:FX_STILL_AT
  });
  // pvp = boss for now (plan default).
  const meteorBoss=Object.freeze({damage:METEOR_BOSS_DAMAGE,radius:METEOR_BOSS_RADIUS});
  const meteorSwarm=Object.freeze({damage:METEOR_SWARM_DAMAGE,radius:METEOR_SWARM_RADIUS});
  const specials=Object.freeze({
    picnic:Object.freeze({id:'picnic',name:'Picnic',family:'team-boost',duration:PICNIC_ACTIVE_S,healFraction:PICNIC_HEAL_FRACTION,
      speed:Object.freeze({bucket:BUCKET_SPEED,mult:PICNIC_SPEED_MULT})}),
    meteor:Object.freeze({id:'meteor',name:'Meteor',family:'big-hit',duration:METEOR_ACTIVE_S,boss:meteorBoss,swarm:meteorSwarm,pvp:meteorBoss}),
    bigPlush:Object.freeze({id:'bigPlush',name:'Big Plush',family:'power-up',duration:BIG_PLUSH_ACTIVE_S,size:BIG_PLUSH_SIZE,
      damage:Object.freeze({bucket:BUCKET_BOOST,mult:BIG_PLUSH_DAMAGE_MULT})})
  });
  // Launch traits (the keys of rumble-synergy-data.js defaultByTrait). Spec section 4: Sprout Picnic, Chomper Meteor, Puff Big Plush.
  // The trait-to-special pairing is an owner-overrulable default: the spec names heroes, not traits.
  const defaultByTrait=Object.freeze({springy:'picnic',heavy:'meteor',piercing:'bigPlush'});
  const data=Object.freeze({
    specials,fx,defaultByTrait,fallbackSpecial:FALLBACK_SPECIAL,
    tap:Object.freeze({maxMovePx:TAP_MAX_MOVE_PX,maxHoldS:TAP_MAX_HOLD_S}),
    buckets:Object.freeze({boost:BUCKET_BOOST,speed:BUCKET_SPEED}),
    setting:Object.freeze({storageKey:SETTING_KEY,modes:SETTING_MODES,fallback:SETTING_FALLBACK}),
    paint:Object.freeze({flag:PAINT_FLAG,on:PAINT_ON,meteor:Object.freeze({src:PAINT_METEOR_SRC,ms:PAINT_METEOR_MS,reducedMs:PAINT_REDUCED_MS,
      popFrom:PAINT_POP_FROM,overshoot:PAINT_OVERSHOOT,peakAt:PAINT_PEAK_AT,holdAt:PAINT_HOLD_AT,fadeTo:PAINT_FADE_TO,turnDeg:PAINT_TURN_DEG})})
  });
  root.LoftRumbleSpecialData=data;
})(typeof globalThis!=='undefined'?globalThis:this);
