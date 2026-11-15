// Bramble in the live fight (LM3): rig scale, shield views and break, the two-way beam and its two source glows.
// Look only: damage, colliders, timings and attack logic never read these numbers. Lengths are logical arena units
// unless noted, times are seconds. Spec: docs/design/LOFT-RUMBLE-LIVING-MAGIC.md ("Boss attacks and defense").
// Texture shares below were measured by studies/measure_boss_fight.py (alpha >= 128).
(function(root){
  'use strict';
  const freeze=Object.freeze;
  root.LoftRumbleBossFightData=freeze({
    // Texture names in art/ (copies of assets/living-magic/boss-rig and boss-poses-and-effects, loaded by art-renderer.js).
    // The rig parts keep the ids of boss-rig-data.js so its rectangles, pivots and poses are reused as they are.
    rigTextures:freeze({torso:'bramble-torso',crown:'bramble-crown',socketLeft:'bramble-arm-socket-left',socketRight:'bramble-arm-socket-right'}),
    // Rig layers drawn in the fight, back to front. The rig's own ground shadow is left out: the camera already draws a
    // contact shadow at the foot (camera-renderer.js, ground), and two ovals read as a dark smudge.
    rigLayers:freeze(['socketLeft','socketRight','torso','crown']),
    textures:freeze({front:'bramble-shield-intact',cracked:'bramble-shield-cracked',side:'bramble-shield-side',rear:'bramble-shield-rear',
      shards:'bramble-shield-shards',beam:'bramble-beam-strip',source:'bramble-beam-source'}),
    // The rig stands where the storybook boss stood (camera-storybook.js): crown top bossTop radii above the collider
    // centre, feet bossFoot radii below it, so the occlusion boxes and the attack label anchor still fit. Pinned by the test.
    storybook:freeze({bossTop:3.7,bossFoot:.9}),
    shield:freeze({
      // Front (intact and cracked share one canvas): the plate spans 0.044-0.956 of the width; at the centre column it
      // runs from 0.352 to its foot at 0.949 of the height.
      // aspect: its 768 x 256 canvas, height over width (assets/living-magic/boss-poses-and-effects/manifest.json).
      front:freeze({span:.912,foot:.949,wall:.597,aspect:256/768}),
      // Rear (the plate's inner face, seen when it is behind the boss): spans 0.038-0.962, foot at 0.969.
      rear:freeze({span:.924,foot:.969}),
      // Side (its own canvas, the left-hand plate; mirrored for the right): content 0.099-0.901 wide, 0.038-0.962 tall,
      // centred at half height.
      side:freeze({spanX:.802,spanY:.924,centreY:.5}),
      // Radians either side of a view boundary over which the plate turns: the one opaque view narrows to turnSquash of
      // its width at the boundary, swaps to its neighbour at that same width, and widens back (a card turning). The
      // 2026-11-15 cross-fade read as a fading ghost (owner); turnSquash 0.3 tuned by eye in the shield-readable captures.
      blend:.2,turnSquash:.3,
      // A new crack shakes the plate this many px for this long (brief: squash, sharp timing). Reduced motion: none.
      crackLife:.25,crackShake:2.5,crackShakeHz:28,
      // Break: the shard sprite (one fragment cluster, spec) bursts where the plate broke at scale x the plate's width,
      // spreads by grow more, drops dropShare of its height to the floor, holds full strength for its first hold share
      // and fades out over life (reduced motion: reducedLife, no spread, no drop). A rimBlur px glow in the page's
      // seed-glow token lifts it off the bark boss and the sand. Owner, 2026-11-15: the 0.6 s plate-sized burst was
      // hard to see; sizes and times tuned by eye in docs/testing/ui/rumble-boss-shield-readable.
      // (scale 1.5 covered the boss's face in the first capture.)
      shards:freeze({life:1,reducedLife:.5,hold:.4,scale:1.25,grow:.5,dropShare:.25,rimBlur:8}),
      // Break flash: a white core disc (coreShare of life) and an amber ring (the page's warning token) at the plate's
      // middle height. Radii in plate radii: the ring starts at start and grows by grow (reduced motion: no growth).
      // width: the ring's line in px at its start, thinning as it fades.
      // (start 0.35 hid the ring under the shards in the first capture.) The amber alone was faint on the sand at
      // 1500x920, so a dark edge (the page's foreground token) edge px wider at edgeAlpha of the ring's alpha sits under it.
      flash:freeze({life:.45,coreShare:.35,coreAlpha:.9,start:.6,grow:1.3,width:7,edge:3,edgeAlpha:.55})
    }),
    beam:freeze({
      // The strip's glow is 0.274 of its height (rows 0.370-0.644); its bright core is 0.068 (0.466-0.534). The glow is
      // drawn laneFill of the lane's width, so the lane's dashed edges stay visible beside the beam.
      glowShare:.274,laneFill:.8,
      // Along its length the strip fades in over its first 0.078 (centre-row alpha reaches 200 there; solid to 0.913,
      // measure_boss_fight.py). That taper is drawn under the boss so the solid beam starts at the glow.
      opaqueFrom:.078,
      // The beam narrows to this share of its width as it fades.
      fadeWidth:.35,
      // The page fills the hit lane (exactly beamHalf each side) at this alpha under the strip. Without it the pale
      // strip vanished against the sand floor in the 2026-11-15 beam capture; the old beam filled it at 0.9 with no art.
      laneAlpha:.6
    }),
    sources:freeze({
      // Two glows on the beam's line at the boss's collider edge, one per direction. size = diameter in boss radii at
      // full charge; a glow starts at minShare of it. The texture's ball sits at (0.492, 0.465) of its canvas.
      size:1.1,minShare:.45,coreX:.492,coreY:.465
    })
  });
})(typeof window!=='undefined'?window:globalThis);
