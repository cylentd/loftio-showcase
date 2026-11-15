(function(root){
  'use strict';
  root.LoftRumbleDragData=Object.freeze({
    pickupLife:.16,pickupScale:.055,heldScale:.025,heldLift:2,
    pullReach:90,pullSquash:.04,
    dragWidth:1.25,dragAlpha:.45,dragFadeStop:.35,thumbRadius:1.75,
    aimRadius:3.6,aimOutline:'#18291f',aimOutlineWidth:2.2,aimAlphaMin:.85,
    launchLife:.2,launchRadius:22,launchSpread:22,launchWidth:3,
    // Fling vs sling (docs/product/LOFT-RUMBLE-FLING-AND-SPECIALS.md, section 1); logic in drag-feedback.js, `fling`.
    fling:Object.freeze({
      // Sling hold: the finger must stay below the minimum swipe speed this long before aim dots and the gauge show. Spec: about 0.15 s.
      holdStill:.15,
      // Fling-power switch, the one tuning value: 'full', 'speed' or 'speed-floor'. Default speed-floor; swipe fatigue is
      // the risk a casual play-test settles (owner, 2026-11-14).
      powerMode:'speed-floor',
      powerFloor:.7,         // speed-floor: any real swipe gets at least this share of full power (spec section 1)
      fullSpeed:1500,        // arena units/s of swipe that gives full power in speed modes; first guess (a comfortable phone swipe), to tune in the play-test
      // Copied from FIDGET in game/src/fidget-data.ts (same values, same meaning):
      sampleMs:100,          // only samples this recent, in ms, make up the swipe
      staleMs:80,            // a last sample older than this, in ms, means the finger has stopped: not a swipe
      minScreenSpeed:480,    // slowest swipe, in screen px/s, that counts
      maxSpeed:2300,         // swipe speed cap, arena units/s
      // Two samples (the press and one move) are the least a speed needs, as in fidget-model. More would make the same
      // short swipe fly either way depending on how many events the device sends (review 2026-11-15; owner chose fling).
      minSamples:2,
      msPerSecond:1000
    }),
    copy:Object.freeze({on:'Rumble on',off:'Rumble off'}),
    cues:Object.freeze({
      grab:Object.freeze({buzz:10,freq:320,to:460,life:.045,gain:.035}),
      armed:Object.freeze({buzz:6,freq:480,to:620,life:.035,gain:.025}),
      launch:Object.freeze({buzz:18,freq:160,to:70,life:.09,gain:.08})
    })
  });
})(globalThis);
