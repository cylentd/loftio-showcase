(function(root){
  'use strict';
  root.LoftRumbleDragData=Object.freeze({
    pickupLife:.16,pickupScale:.055,heldScale:.025,heldLift:2,
    pullReach:90,pullSquash:.04,
    dragWidth:1.25,dragAlpha:.45,dragFadeStop:.35,thumbRadius:1.75,
    aimRadius:3.6,aimOutline:'#18291f',aimOutlineWidth:2.2,aimAlphaMin:.85,
    launchLife:.2,launchRadius:22,launchSpread:22,launchWidth:3,
    // Throw style setting: one throw mode at a time (owner, 2026-11-15; spec section 1). Logic in drag-feedback.js, `throwStyle`.
    throwStyle:Object.freeze({
      styles:Object.freeze(['fling','sling']),
      fallback:'fling',               // the default, and what an unknown saved value reads as
      storageKey:'loftRumbleThrow',   // localStorage, read and written like loftRumbleMusic
      // Player-facing words keyed by style (unit B): the settings control, the board's label and the page's hints. A style's
      // words never describe the other style's gesture (throw-style-copy.test.cjs).
      copy:Object.freeze({
        label:'Throw',
        names:Object.freeze({fling:'Fling',sling:'Sling'}),
        board:Object.freeze({
          fling:"Swipe any ready resident toward the enemy's gold weak spot to fling it, or drag, hold still to aim along the drag and let go. Several can move at once. Drag back to the start to cancel.",
          sling:"Press on any ready resident, pull back and release to sling it at the enemy's gold weak spot. Several can move at once. Drag back to the start to cancel."
        }),
        start:Object.freeze({fling:'Swipe a resident toward the enemy.',sling:'Drag from any resident, pull back, release.'}),
        cancel:Object.freeze({fling:'Fling cancelled.',sling:'Sling cancelled.'}),
        tutor:Object.freeze({fling:'Swipe to fling',sling:'Pull back, release'}),   // the lab's first-battle step, 4 words max
        roster:Object.freeze({   // the team dock's screen-reader label
          fling:'Residents. SPECIAL means the next fling fires the special.',
          sling:'Residents. SPECIAL means the next sling fires the special.'
        })
      })
    }),
    // Fling and sling input (docs/product/LOFT-RUMBLE-FLING-AND-SPECIALS.md, section 1); logic in drag-feedback.js, `fling`.
    fling:Object.freeze({
      // Hold: the finger must stay below the minimum swipe speed this long before the gauge runs (both modes) and the sling's
      // aim dots show. Spec: about 0.15 s.
      holdStill:.15,
      // Fling-power switch: 'full', 'speed' or 'speed-floor'. 'full' since 2026-11-15: fling and sling reach the same distance,
      // so the throw style is an input choice, never an advantage (owner; was speed-floor, which gave casual swipes 70%).
      powerMode:'full',
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
    // Steady sling aim (spec section 1, as built; logic in drag-feedback.js, `aim`). The sling aims from a point that trails the
    // finger and moves only once the finger is more than steadyPx CSS px from it, so finger noise never turns the shot.
    aim:Object.freeze({
      // 3 CSS px: just above the 1-2 px of touch noise in the iPhone report (owner, 2026-11-15), so 2 px of sideways noise on a
      // 45 px pull turns the sling 0.4 degrees instead of 2.1 (phone measure, 390x844 at devicePixelRatio 3). A deliberate move
      // still turns it at once: no delay, and at most 3 px of slack on a reversal.
      steadyPx:3
    }),
    copy:Object.freeze({on:'Rumble on',off:'Rumble off'}),
    cues:Object.freeze({
      grab:Object.freeze({buzz:10,freq:320,to:460,life:.045,gain:.035}),
      armed:Object.freeze({buzz:6,freq:480,to:620,life:.035,gain:.025}),
      launch:Object.freeze({buzz:18,freq:160,to:70,life:.09,gain:.08})
    })
  });
})(globalThis);
