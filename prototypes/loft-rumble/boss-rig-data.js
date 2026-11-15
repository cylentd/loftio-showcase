// Bramble torso/crown rig: pivots, part placements, phase durations and keyframes for the dev-only preview
// (boss-rig-preview.html). Spec: docs/design/LOFT-RUMBLE-LIVING-MAGIC.md, "Boss animation construction".
// Rig space is the 900 x 1050 canvas of assets/living-magic/boss-rig/assembly-candidate.json; y grows down.
(function(root){
  'use strict';
  const freeze=Object.freeze;
  const P=(x,y)=>freeze({x,y});
  root.LoftRumbleBossRigData=freeze({
    textureDir:'assets/living-magic/boss-rig/textures/',
    effectDir:'assets/living-magic/boss-poses-and-effects/textures/',
    rigCanvas:freeze({w:900,h:1050}),
    // Part rectangles in rig space. Starting values: assembly-candidate.json; changes are fit fixes, noted per part.
    parts:freeze({
      shadow:freeze({file:'bramble-ground-shadow.webp',x:245,y:893,w:410,h:97}),
      socketLeft:freeze({file:'bramble-arm-socket-left.webp',x:228,y:655,w:145,h:105}),
      socketRight:freeze({file:'bramble-arm-socket-right.webp',x:528,y:638,w:145,h:122}),
      torso:freeze({file:'bramble-torso.webp',x:275,y:473,w:350,h:502}),
      // Candidate y was -3; lowered 26 so the crown's V tip overlaps the brow ridge (fit finding F1 in the README).
      crown:freeze({file:'bramble-crown.webp',x:85,y:23,w:730,h:607})
    }),
    // Draw order, back to front (spec layer order: shadow, rear pieces, body with near sockets tucked behind it, crown).
    layers:freeze(['shadow','socketLeft','socketRight','torso','crown']),
    // Explicit pivots in rig space. Each part rotates about its own pivot; children follow their parent's transformed attach point.
    pivots:freeze({
      foot:P(450,975),      // bottom centre of the torso's feet: the ground anchor, never moves while grounded
      brow:P(450,604),      // top of the torso's brow ridge: where the crown's V sits
      eyes:P(450,650),      // top of the eye glow: the crown must never come down to it
      crown:P(462,596),     // the crown's V tip, its rotation pivot; attaches to `brow`
      shoulderLeft:P(352,690),  // torso point the left socket hangs from (hidden behind the torso)
      socketLeft:P(352,686),    // the left socket's root end, its rotation pivot
      shoulderRight:P(548,676),
      socketRight:P(546,668)
    }),
    // Shadow centre sits this far above the foot pivot, in rig units: the oval reads under the feet in the 3/4 view.
    shadowLift:34,
    // How much the logical boss is drawn: rig height (crown top to feet) in boss radii. The game draws its boss art in a
    // box of bossSize 2.25 radii (art-manifest.js); the crown overhangs that box, so the rig gets a little more.
    rigHeightRadii:2.7,
    // Game numbers this preview must agree with. Source: loft-rumble-realtime.html (C, FEEL). Copied, not shared, because
    // this page must not load the game; boss-rig-model.test.cjs pins the copies against the game file.
    game:freeze({arenaW:360,arenaH:640,enemyX:.5,enemyY:.3,enemyRadius:38,slamRadius:.36,slamMin:140,slamHop:22,
      windup:.34,travel:.22,slamRingLife:.32}),
    // Slam phases, in order, with seconds. rise and fall use the game's windup and travel; impact is the game's ring life.
    // crouch and recover are the preview's anticipation and settle, first guesses to tune by eye.
    slamPhases:freeze(['crouch','rise','fall','impact','recover']),
    durations:freeze({crouch:.55,rise:.34,fall:.22,impact:.32,recover:.7}),
    idlePeriod:2.6,         // seconds per idle breath
    // Pose channels: sx, sy = torso scale about the foot pivot; lean = torso rotation (radians) about the foot;
    // crownDy = extra crown drop (rig units, + is down, lag on landings); crownRot = crown rotation (radians) about its V;
    // arm = socket rotation (radians, + swings the knuckle outward); lift = share of the hop height (0 grounded, 1 apex).
    rest:freeze({sx:1,sy:1,lean:0,crownDy:0,crownRot:0,arm:0,lift:0}),
    idle:freeze({sy:.018,sx:-.008,crownRot:.022,crownLag:.12,arm:.05}), // amplitudes of a sine breath; crownLag = share of a period
    // Keyframes per phase: [share of the phase, pose]. Values not listed hold the rest pose. Linear between keys after easing.
    keys:freeze({
      crouch:freeze([[0,{}],[1,{sx:1.07,sy:.9,crownDy:6,arm:-.12}]]),
      rise:freeze([[0,{sx:1.07,sy:.9,crownDy:6,arm:-.12}],[.35,{sx:.95,sy:1.07,crownDy:-4,arm:.18,lift:.5}],[1,{sx:.98,sy:1.03,crownDy:-2,arm:.22,lift:1}]]),
      fall:freeze([[0,{sx:.98,sy:1.03,crownDy:-2,arm:.22,lift:1}],[1,{sx:.97,sy:1.05,crownDy:-6,arm:.26,lift:0}]]),
      impact:freeze([[0,{sx:1.14,sy:.84,crownDy:10,arm:-.2}],[.4,{sx:1.1,sy:.88,crownDy:14,crownRot:-.03,arm:-.16}],[1,{sx:1.04,sy:.95,crownDy:5,crownRot:.02,arm:-.06}]]),
      recover:freeze([[0,{sx:1.04,sy:.95,crownDy:5,crownRot:.02,arm:-.06}],[.4,{sx:.985,sy:1.02,crownDy:-2,arm:.03}],[1,{}]])
    }),
    // Easing per phase. rise/fall mirror the game's hop curve: up = sin(k*pi/2), down = 1-k^2.
    ease:freeze({crouch:'sineInOut',rise:'sineOut',fall:'quadIn',impact:'quadOut',recover:'sineInOut'}),
    // Shadow under the hop: at the apex it shrinks to this scale and fades to this opacity.
    shadow:freeze({apexScale:.62,apexAlpha:.45,alpha:.85}),
    // Impact sprite: width as a share of the warning ring's diameter (must sit well inside it), and its fade.
    impact:freeze({file:'bramble-slam-impact.webp',ringShare:.62,growFrom:.7,life:.62}),
    // Debris on landing: few, short-lived, independent pieces (spec). dist is a share of the warning radius, so no piece
    // lands outside the zone; h = arc height in boss radii; size in boss radii; life in seconds; spin in turns.
    debrisFiles:freeze({stone:'bramble-particle-stone.webp',bark:'bramble-particle-bark.webp',leaf:'bramble-particle-leaf.webp'}),
    debris:freeze([
      freeze({kind:'stone',angle:-160,dist:.55,h:.9,size:.2,life:.55,spin:.6}),
      freeze({kind:'stone',angle:30,dist:.6,h:1,size:.22,life:.6,spin:-.5}),
      freeze({kind:'bark',angle:-120,dist:.45,h:1.3,size:.18,life:.62,spin:1.1}),
      freeze({kind:'bark',angle:55,dist:.5,h:1.2,size:.17,life:.58,spin:-1}),
      freeze({kind:'stone',angle:165,dist:.4,h:.6,size:.15,life:.48,spin:.4}),
      freeze({kind:'stone',angle:15,dist:.42,h:.7,size:.14,life:.5,spin:-.4}),
      freeze({kind:'leaf',angle:-100,dist:.35,h:1.6,size:.16,life:.9,spin:.3}),
      freeze({kind:'leaf',angle:120,dist:.38,h:1.5,size:.15,life:.95,spin:-.35})
    ]),
    // Reduced motion: no hop, no squash, no debris, no breath: the boss holds its rest pose (poseShare 0) and only the ring, shockwave and impact show.
    reduced:freeze({poseShare:0}),
    speeds:freeze([1,.5,.25]),
    // Overlay styling in screen pixels.
    // labelMinScale: below this close-up scale (screen px per rig unit, phone width) pivot labels collide, so only crosses draw.
    overlay:freeze({cross:7,line:1.5,dash:6,label:11,labelGap:4,labelHalo:3,labelMinScale:.45}),
    // Views. arena: the ring's fill and edge (the game's zone draw uses a soft fill under a stronger edge), the arena
    // border, and how tall a slice of the arena a short canvas shows (logical units, from the top; the zone fits in it).
    view:freeze({ringFill:.16,ringEdge:.85,ringWidth:2.5,shockWidth:8,shockMin:2,arenaEdge:2,minSlice:400,
      // zoom: margin around the rig in rig units, with room above for the hop apex.
      zoomPad:40}),
    // Seconds of rest between Slam loops when the Slam attack loops.
    slamGap:1.2
  });
})(typeof window!=='undefined'?window:globalThis);
