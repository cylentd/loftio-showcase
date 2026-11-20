(function(root){
  'use strict';
  // Swarm stage data (ledger #487). Every number the swarm model reads lives here; change a number here, nowhere else.
  // Provenance: the brief (ledger #487, owner 2026-11-19) fixes the two modes, the three kinds' roles, LIVE_CAP and SPAWN_RUNE_S.
  // The rest are first guesses tuned against studies/swarm-sim.test.cjs, which pins the clear time they must give.
  const MODES=Object.freeze({
    hunt:Object.freeze({goal:60}),   // defeat 60 monsters (brief #487)
    hold:Object.freeze({goal:120}),  // survive 120 seconds (brief #487)
  });
  const SWARM_LIVE=false;            // off until the owner has seen the stage (brief #487); the wiring unit reads it

  // The play field and the team pool match the Bramble fight (loft-rumble-realtime.html: C.arenaW 360, C.arenaH 640).
  const ARENA=Object.freeze({w:360,h:640});
  const SPAWN_BAND=Object.freeze({top:.08,bottom:.3}); // spawn y as a share of arena height: the top band, away from the heroes at the bottom
  const SPAWN_MIN_HERO_DIST=90;      // a spawn closer than this to any hero is skipped (brief #487 "min distance"); about 3 hero widths of radius 15
  const FIRST_SPAWN_S=1;             // seconds before the first monster
  const LIVE_CAP=18;                 // monsters alive or spawning at once (brief #487)
  const SPAWN_RUNE_S=.6;             // spawning life: the rune shows, the monster cannot be hit (brief #487)
  const DYING_S=.4;                  // dying life: the puff plays, then the monster is removed
  const LAB_SEED=487;                // the lab's fixed seed so a run replays: the ledger item number, no other meaning
  const HELD_S=1e6;                  // a clock or timer held here never fires: far above any fight length (a finite number keeps JSON clones); used for the boss attack clock and a monster's guard plate
  const MAX_DT=.1;                   // one tick never advances more than this, so nothing tunnels through a hero

  // Tuning round 2 (swarm-sim): capling contact 4->2, mossback hp 260->150 and contact 12->6, sporemoth contact 3->2, hpScale 1.15/1.3 -> 1.1/1.2.
  // Tuning round 3: capling contactCd .8->1, mossback contact 6->5, SHOT_DAMAGE 2->1.5.
  // Tuning round 4: mossback contact 5->4, sporemoth spitEvery 4->5.
  // Kinds. speed in arena units per second, r in arena units, contact is team HP lost per touch (team pool 100, RT.teamHP),
  // contactCd the seconds before the same monster can touch again.
  const KINDS=Object.freeze({
    capling:Object.freeze({role:'swarmer',hp:30,speed:70,r:11,contact:2,contactCd:1}),
    mossback:Object.freeze({role:'tank',hp:150,speed:28,r:22,contact:4,contactCd:1.2}),
    sporemoth:Object.freeze({role:'spitter',hp:55,speed:40,r:13,contact:2,contactCd:1,
      keepMin:150,keepMax:210,        // it moves toward a hero beyond keepMax and away inside keepMin
      spitEvery:5}),                  // seconds between spits; tuning rounds 1 and 4 (was 3.2)
  });
  const IDS=Object.freeze(Object.keys(KINDS));

  const TELEGRAPH_S=.7;              // a spit shows its ring this long before the seed flies
  const SHOT_SPEED=150;              // arena units per second, slower than a thrown hero so it reads
  const SHOT_R=6;                    // hit radius, arena units: about half a capling (r 11), so a dodge reads fair. The view draws the
                                     // fx-seed-projectile at 2.4x this (rumble-hud-data swarm.seed.size) and the telegraph ring at 5x (swarm.telegraph.radius)
  const SHOT_DAMAGE=1.5;              // team HP; tuning round 1 (6 let static bot heroes die to spits alone)

  // Ramp: the row with the largest `from` (seconds) not above the clock applies. interval is seconds between spawns,
  // hpScale multiplies a kind's hp, weights pick the kind (they need not sum to 1).
  const RAMP=Object.freeze([
    Object.freeze({from:0,interval:2,hpScale:1,weights:Object.freeze({capling:.7,mossback:.1,sporemoth:.2})}),
    Object.freeze({from:30,interval:1.7,hpScale:1.1,weights:Object.freeze({capling:.55,mossback:.2,sporemoth:.25})}),
    Object.freeze({from:70,interval:1.4,hpScale:1.2,weights:Object.freeze({capling:.5,mossback:.25,sporemoth:.25})}),
  ]);

  const api=Object.freeze({MODES,SWARM_LIVE,ARENA,SPAWN_BAND,SPAWN_MIN_HERO_DIST,FIRST_SPAWN_S,LIVE_CAP,SPAWN_RUNE_S,DYING_S,MAX_DT,LAB_SEED,HELD_S,
    KINDS,IDS,TELEGRAPH_S,SHOT_SPEED,SHOT_R,SHOT_DAMAGE,RAMP});
  root.LoftRumbleSwarmData=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
