// Bramble in the live fight (LM3): rig scale, shield views and break, the two-way beam and its two source glows.
// Look only, except `guard` (the shield's rules, owner 2026-11-18): damage, colliders, timings and attack logic never
// read the other numbers. Lengths are logical arena units
// unless noted, times are seconds. Spec: docs/design/LOFT-RUMBLE-LIVING-MAGIC.md ("Boss attacks and defense").
// Texture shares below were measured by studies/measure_boss_fight.py (alpha >= 128).
(function(root){
  'use strict';
  const freeze=Object.freeze;
  root.LoftRumbleBossFightData=freeze({
    // Texture names in art/ (copies of assets/living-magic/boss-rig and boss-poses-and-effects, loaded by art-renderer.js).
    // The rig parts keep the ids of boss-rig-data.js so its rectangles, pivots and poses are reused as they are.
    rigTextures:freeze({torso:'bramble-torso',crown:'bramble-crown',socketLeft:'bramble-arm-socket-left',socketRight:'bramble-arm-socket-right'}),
    // Rig layers drawn in the fight, back to front. The rig's ground shadow is not one of them: slam.shadow below draws
    // it at the foot under the rear shield, in place of the camera's contact oval (two ovals read as a dark smudge).
    rigLayers:freeze(['socketLeft','socketRight','torso','crown']),
    textures:freeze({front:'bramble-shield-intact',cracked:'bramble-shield-cracked',side:'bramble-shield-side',rear:'bramble-shield-rear',
      shards:'bramble-shield-shards',beam:'bramble-beam-strip',source:'bramble-beam-source'}),
    // The rig stands where the storybook boss stood (camera-storybook.js): crown top bossTop radii above the collider
    // centre, feet bossFoot radii below it, so the occlusion boxes and the attack label anchor still fit. Pinned by the test.
    storybook:freeze({bossTop:3.7,bossFoot:.9}),
    // The shield guards the weak spot (owner decision 2026-11-18, #426; replaces the rotating plate). Rules, not look:
    // the page's shieldHit and stepShield read these through boss-fight-model.js guardHit / guardStep.
    // hp: the plate's shield HP; heavyShare / otherShare: the share of hp a Chomper-or-heavy / any other hit takes; crackedShare /
    // darkShare: the HP shares at or under which the crack art shows its first and second stage. exposedSeconds: how long the weak spot stays open after the break.
    // No exposed multiplier: the broken weak spot takes the usual weak-spot damage (owner, round 2, 2026-11-18).
    // regrowSeconds: the plate's regrow after the window (Look round pick, owner to judge). regrowStart: the plate's
    // width share as it starts to regrow, widening to 1 (Look round pick, owner to judge).
    // No gold glow on the exposed weak spot (owner 2026-11-18, round 6: "Why the heck is that yellow thing?").
    // Shield health (owner's 2026-11-18 shield-health change, round 4; replaces the 3-crack count): hp is the plate's
    // integer health. heavyShare: a Chomper or heavy-trait plate hit takes a third (4 of 12, breaks in 3); otherShare:
    // anyone else (not piercing) takes a twelfth (1 of 12, breaks in 12). Piercing takes none. crackedShare and darkShare:
    // the plate shows the cracked art at 2/3 HP or less (8) and cracked and darkened at 1/3 or less (4).
    // Lift opening (owner 2026-11-18, shield lift opening, #445 option A): as the boss rises for an attack the plate lifts
    // clear of the weak spot. liftOpenAt: the attack envelope (actLevel, 0..1) from which the plate counts as lifted and a
    // weak-arc hit is an opening (x3 for anyone, no shield HP). liftHeight: the plate's rise at the apex in plate heights
    // (Look round pick from stills, owner to judge). Enrage only makes attacks come sooner; the opening is the same size.
    guard:freeze({hp:12,heavyShare:1/3,otherShare:1/12,crackedShare:2/3,darkShare:1/3,exposedSeconds:6,regrowSeconds:.6,regrowStart:.2,
      liftOpenAt:.6,liftHeight:1.4}),
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
      // The page fills the hit lane (exactly beamHalf each side) at this alpha under the strip. 0.6 (2026-11-15) drew a
      // wide solid purple band that buried the beam; the concept (mockups/rumble-living-magic/beam-bidirectional-and-
      // shield.webp, FIRE) shrinks the lane to a thin purple outline while the beam fires, so the fill is a faint tint
      // and laneEdge carries the danger edge: line alpha and width in px, exactly at beamHalf.
      laneAlpha:.1,laneEdge:freeze({alpha:.95,width:2.5}),
      // The fired look over the strip (concept FIRE). Half-widths are shares of beamHalf, so no layer leaves the lane.
      // glow: the warm amber band (page token --beam-fire); core: the thick warm-white centre (--beam-core). The strip's own
      // core is 0.068 of its height (12 units at laneFill), a third of the concept's, hence the canvas core under it.
      // solid: the share of each band at full colour before it fades to clear at its edges. (Glow 0.6 with no solid
      // plateau was lost on the sand floor in the first capture; solid 0.3 read half the lane wide in the second.)
      glow:freeze({half:.95,alpha:.8,solid:.6}),core:freeze({half:.4,alpha:1,solid:.55}),
      // The core breathes by depth of its width at hz (concept: "pulsed along its length"). Reduced motion: still.
      pulse:freeze({hz:9,depth:.18}),
      // Bright bands run outward from the boss along both beams (the scroll): spacing and band length in units, speed in
      // units/s, peak alpha over the core. Tuned by eye in docs/testing/ui/rumble-boss-beam-concept. Reduced motion: none.
      runs:freeze({spacing:150,length:60,speed:900,alpha:.55}),
      // The look's own strength: full for the first hold share of beamFade (the concept's FIRE frame), then eases out
      // (FADE). The strip keeps the model's linear fade (beamSegments), which tests pin.
      hold:.35,
      // Spiral-rune glows where each beam meets the arena wall (concept: one at each end). The source texture, size in
      // boss radii; inset: units in from the play rect's edge so the glow sits on the floor by the wall, not under it.
      end:freeze({size:1,inset:22}),
      // Leaf and spark particles streaming outward along each beam (concept FIRE), cut from fx-hit-spark.webp: boxes x, y,
      // w, h in texture px from studies/measure_beam_particles.py. count per beam; one in every leafEvery is a leaf.
      // life s; run: share of the beam a particle travels in its life; size in units; spin turns/s. A particle's centre
      // plus half its size stays inside spread of beamHalf, so particles never leave the lane. Reduced motion: none.
      particles:freeze({texture:'fx-hit-spark',
        crops:freeze({spark:freeze([freeze([268,9,78,91]),freeze([275,248,68,54]),freeze([9,164,73,41]),freeze([123,105,34,35])]),
          leaf:freeze([freeze([76,48,51,46]),freeze([327,148,48,41]),freeze([77,278,42,38])])}),
        // (Sizes 11 and 13 were specks in the first capture, 14 and 18 still small in the second.)
        count:10,leafEvery:3,life:.32,run:.35,size:freeze({spark:17,leaf:20}),spin:1.5,spread:.85,
        // FADE: the beam dissolves into fadeCount drifting leaves per beam that slide drift units outward, sink sink
        // units, spin, and fade out linearly over the FADE (slower than the core, so they outlast it).
        fadeCount:6,drift:40,sink:14,
        // Each particle's fixed random shares come from the common sine hash fract(sin(n*index + m*channel) * scale)
        // (the well-known GLSL one-liner), so the particles are a pure function of time and repeat in every capture.
        hash:freeze({index:12.9898,channel:78.233,scale:43758.5453})}),
      // CHARGE: chevrons in the purple lane pointing away from the boss, every spacing units from the collider edge to the
      // wall, size (tip to back) as a share of beamHalf, crawling outward at speed units/s (reduced motion: still). Alpha
      // rises from alpha to alpha + charge as the windup charges. Stroke and a faint fill in the lane's colour.
      // (alpha 0.55, fill 0.18, width 2 and spacing 70 were faint and sparse in the first capture.)
      chevrons:freeze({spacing:60,size:.7,speed:60,alpha:.7,charge:.3,fill:.35,width:3})
    }),
    sources:freeze({
      // Two glows on the beam's line at the boss's collider edge, one per direction. size = diameter in boss radii at
      // full charge; a glow starts at minShare of it. The texture's ball sits at (0.492, 0.465) of its canvas.
      size:1.1,minShare:.45,coreX:.492,coreY:.465
    }),
    // Slam landing (LM3b): the v2 crack, the rig's bark, stone and leaf debris, and the hop shadow. Look only: the ring,
    // the zone, the damage tick and the Dodged check never read these.
    slam:freeze({
      crack:freeze({texture:'bramble-slam-impact-v2',
        // Visible bounds (alpha >= 8) and the white-hot core's centroid, shares of the canvas (measure_boss_fight.py;
        // also in the asset manifest). The core sits on the boss's foot, where it lands.
        left:.034,top:.27,right:.966,bottom:.746,coreX:.496,coreY:.497,
        // The farther fissure tip reaches tipShare of the warning ring's radius from the ring centre, so the crack never
        // implies damage past the ring (spec) and the shockwave's last frames still cross bare floor. Tuned by eye in
        // docs/testing/ui/rumble-slam-impact.
        tipShare:.82,
        // It opens from growFrom of its size over grow s (reduced motion: full size at once), holds at full strength
        // through the game's shockwave (slamRingLife) and fades out over fade s. hold + fade must end before the page
        // drops its attack effect, 0.99 s after the landing (attackResponse 1 + vignetteLife 0.55 - windup - travel).
        growFrom:.55,grow:.12,fade:.6
      }),
      // Debris textures per rig piece kind (boss-rig-data.js debris; its counts, arcs and lives are reused as they are).
      debris:freeze({stone:'bramble-particle-stone',bark:'bramble-particle-bark',leaf:'bramble-particle-leaf'}),
      // The rig's piece sizes (0.14-0.22 boss radii) were set in the zoomed preview; in the fight they drew 5-8 units,
      // specks at 390x844. debrisScale x that reads as chips beside the feet, still under a resident's size (capture
      // slam_impact_0_2 in docs/testing/ui/rumble-slam-impact).
      debrisScale:2.2,
      // Reduced motion keeps every reducedEvery-th piece, resting where it would land, fading over its life: no flight.
      reducedEvery:2,
      // The rig's ground shadow at the foot anchor, shrinking and fading with the hop (boss-rig-data.js shadow). on:
      // drawn in place of the camera's flat contact oval for the boss, so the two never stack into a smudge (LM3's reason
      // for leaving it out). See the README in docs/testing/ui/rumble-slam-impact.
      // drop: rig units to lower it. The preview centres it shadowLift (34) above the foot, which in the fight hid it
      // behind the feet; dropped 34 it sits on the foot line, like the camera oval it replaces. widen: its visible
      // width (0.656 of 410 rig units) is 49 units at fight scale; x1.5 matches that oval's 76 (2 boss radii).
      shadow:freeze({texture:'bramble-ground-shadow',on:true,drop:34,widen:1.5})
    })
  });
})(typeof window!=='undefined'?window:globalThis);
