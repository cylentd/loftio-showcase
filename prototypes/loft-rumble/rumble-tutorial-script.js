// Loft Rumble Training script: every beat's staging and every named number the stage uses. Plain data, no behaviour.
// Spec: docs/product/LOFT-RUMBLE-TUTORIAL.md. Behaviour: rumble-tutorial-stage.js. Lifecycle: rumble-tutorial-model.js.
(function(root){
  'use strict';
  // Beat budgets in seconds: spec "The seven beats", 2026-11-13. 3 + 12 + 15 + 12 + 18 + 12 + 4 = 76 s.
  const INTRO_SECONDS=3;
  const SLING_SECONDS=12;
  const CHAIN_SECONDS=15;
  const WEAK_SECONDS=12;
  const DODGE_SECONDS=18;
  const SPECIAL_SECONDS=12;
  const GRADUATE_SECONDS=4;
  const GRADUATE_SHOW_SECONDS=2; // the stamp; the other half of the graduate budget is the "Ready to Rumble" cheer
  const GRADUATE_CHEER_SECONDS=2;
  // Places as fractions of the 360 x 640 arena (x of its width, y of its height), picked on the tutorial layout's one bumper
  // at its middle so a straight sling from each spot to Bramble (at .5, .3) clears it.
  const SPROUT_SLING_SPOT=Object.freeze([.17,.66]);
  const PUFF_SPECIAL_SPOT=Object.freeze([.83,.52]);
  const CHOMPER_LANE_SHARE=.45; // how far from Puff toward Bramble Chomper stands, so Puff's sling bumps it on the way
  // Bramble turns his weak spot (the gold arc) toward the team: radians, 0 = right, positive = down; Sprout's spot sits within
  // the arc's .55 rad half-width of it (C.weakArc in the page).
  const WEAK_FACING=1.8;
  const BEAM_LOCK_SECONDS=2.5; // enemy clock when the dodge lane locks; inside the page's 3 s telegraph, so the lane shows
  // A resident's place in a beat: 'home' (its start), null (parked off the arena's left edge), [x, y] as fractions of the arena,
  // or {lane:{from, share}}: a share of the way from another resident's home to Bramble, so it stands in that sling's path.
  const HOME=Object.freeze({sprout:'home',chomper:'home',custom:'home'});
  const field=(sprout,chomper,custom)=>Object.freeze({sprout,chomper,custom});
  const beats=Object.freeze({
    intro:Object.freeze({seconds:INTRO_SECONDS,field:HOME}),
    sling:Object.freeze({seconds:SLING_SECONDS,field:field(SPROUT_SLING_SPOT,null,null),
      aim:Object.freeze({actor:'sprout',at:'bramble'})}),
    chain:Object.freeze({seconds:CHAIN_SECONDS,field:field(null,{lane:{from:'custom',share:CHOMPER_LANE_SHARE}},'home'),
      aim:Object.freeze({actor:'custom',at:'bramble'})}),
    weak:Object.freeze({seconds:WEAK_SECONDS,field:field(SPROUT_SLING_SPOT,'home','home'),facing:WEAK_FACING,
      aim:Object.freeze({actor:'sprout',at:'bramble'})}),
    // Paced by the Beam, not by idle time: the lane is locked with Chomper inside it, and only grabbing Chomper starts the clock.
    dodge:Object.freeze({seconds:DODGE_SECONDS,field:HOME,paced:true,gate:'chomper',
      lock:Object.freeze({attack:'beam',target:'chomper',seconds:BEAM_LOCK_SECONDS}),
      aim:Object.freeze({actor:'chomper',at:'escape'})}),
    special:Object.freeze({seconds:SPECIAL_SECONDS,field:field('home','home',PUFF_SPECIAL_SPOT),
      charge:Object.freeze({custom:1}),aim:Object.freeze({actor:'custom',at:'bramble'})}),
    graduate:Object.freeze({seconds:GRADUATE_SECONDS,show:GRADUATE_SHOW_SECONDS,cheer:GRADUATE_CHEER_SECONDS,field:HOME})
  });
  const DEMO_SECONDS=3;       // how long the ghost hand demonstrates before the player's turn
  const STALL_SHARE=.5;       // a try with no progress for this share of the beat's seconds shows the demo again
  const CHEER_SECONDS=1.2;    // reward length after a lesson's exit
  const RECOVER_SECONDS=1.5;  // after a caught dodge: the stun reads, then the beat is staged again
  const REGRANT_SECONDS=1.5;  // sim seconds a missed special waits before Puff's portrait refills (the old practice's value)
  const SHIELD_HOLD=3600;     // seconds of "shield down" written whenever it drops below half: Training never blocks a sling
  const PARK_X=-.5;           // parked residents stand this fraction of the arena width left of its edge
  const DEMO_PULL=45;         // logical units the ghost hand drags back; past FEEL.cancelRadius (30), so the shot is a real sling
  root.LoftRumbleTutorialScript=Object.freeze({
    flagParam:'training',                // Training runs only on a page opened with ?training, until the real view (U5) lands
    storageKey:'loftRumbleTraining',     // versioned record {version,status}; the old practice keys are never read or written
    version:1,                           // bump when the record shape changes; an unknown version reads as no record
    statuses:Object.freeze(['done','skipped']),
    layoutId:'tutorial',                 // the existing one-bumper stage layout (stage-layout-data.js)
    beats,
    demoSeconds:DEMO_SECONDS,
    stallShare:STALL_SHARE,
    cheerSeconds:CHEER_SECONDS,
    recoverSeconds:RECOVER_SECONDS,
    regrantDelay:REGRANT_SECONDS,
    shieldHold:SHIELD_HOLD,
    parkX:PARK_X,
    demoPull:DEMO_PULL,
    escapeTurn:Math.PI/2                 // the dodge demo slings Chomper at a right angle to the locked lane
  });
})(globalThis);
