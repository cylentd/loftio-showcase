// Look defaults, in world units/seconds. These are owner-tunable prototype choices.
// Dusk look restored 2026-11-17 (owner: the daylight pass "looks worse"): strong glow, mist, shafts and wind.
export const LOOK={seed:17,sides:8,epsilon:1e-7,rayRange:260,exposure:1.12,glow:.24,mist:1.35,shafts:.2,wind:1, // mist 1.35 = 50% on the panel slider (owner, 2026-11-18: 70% then 60% felt too foggy; more than the old 1 still hides far things drawing in)
  emission:2.4,feedbackSpeed:30,feedbackGain:.12,compression:.12,leafCount:650,leafRadius:.34};
export const ROUTE=[
  {id:'route-rock',material:'rock',x:36,z:38,r:3.4,height:3,base:-.4,topScale:.68,color:'#6b5a86'},
  {id:'route-step',material:'rock',x:40,z:34,r:2.2,height:1.8,base:-.3,topScale:.75,color:'#7d6c96'},
  {id:'route-spring',material:'spring',x:44,z:44,r:3,height:3.2,base:2,topScale:.65,color:'#bc7046'},
  {id:'route-shrub',material:'foliage',x:49,z:49,r:2.8,height:1.8,base:-.2,topScale:.55,color:'#42694a'},
];
export const FEEDBACK={
  rock:{sound:'dry',duration:.12,compression:.018,f0:210,f1:90,send:.02,type:'triangle'},
  spring:{sound:'elastic',duration:.42,compression:.12,f0:180,f1:520,send:.18,type:'sine'},
  foliage:{sound:'rustle',duration:.22,compression:.08,f0:1300,f1:520,send:.03,type:'lowpass'},
};
export const HABITATS=[
  {x:20,z:24,r:5,kind:'fern'}, {x:29,z:42,r:4,kind:'fern'},
  {x:37,z:33,r:4,kind:'litter'}, {x:40,z:41,r:3,kind:'litter'},
  {x:47,z:50,r:4,kind:'reed'}, {x:23,z:49,r:4,kind:'reed'},
  {x:16,z:18,r:5,kind:'fern'}, {x:52,z:56,r:4,kind:'fern'},
];
// A deep, dense meadow: 280k blades up to 1.2 units tall on desktop (the sparse 36k lawn read as bare ground).
// Phone matches desktop (owner on a Fold7, 2026-11-17: the 90k blades in a 70-unit tile read thin, and the tile edge
// 35 units out was visible as grass appearing while walking). tile: side of the square of blades that follows the player.
// Taller (owner on a Fold7, 2026-11-17: "thick enough but not tall enough"): blade height x1.33, so .3+.55 became .4+.73.
// Edge hidden (same day: "edge still visible"): blades shrink toward the ground from farFrom units out to the tile edge
// instead of vanishing in an 11-unit band, and widen as they shrink (farWiden) so fewer cover more; the ground
// wears the colour and fine blade mottle of the blade tops (groundGrass 0..1 of the way there, groundTop = the blade
// height whose colour and light it copies, groundBlade = mottle strength, fading out between bladeNear and bladeFar
// units from the camera so far ground does not shimmer).
export const GLADE_GRASS_LOOK = { rootShade: .32, shadeEnd: .58 };

export const MEADOW_LOOK={desktopCount:280000,phoneCount:200000,desktopTile:96,phoneTile:96,width:.075,heightMin:.4,heightSpan:.73,softness:.3,groundGrain:.1,groundMottle:.2,habitatCount:0,
  farFrom:24,farWiden:1.3,groundGrass:.9,groundTop:.65,groundBlade:.35,bladeNear:25,bladeFar:80,
  // Plush ground pass (2026-11-17, art polish step 2: the meadow read as identical flat paddles of one green). Every
  // strength is 0..1 unless said; 0 turns the effect off, so each can be judged alone.
  round:.5,        // cross-blade normal tilt: each blade is lit as if rounded, so one side is lighter than the other
  edgeDark:.22,     // blade sides darken by this much toward the silhouette (soft rim, less cut paper)
  jitterValue:.34,  // per-blade lightness spread (a hash of the blade's seat), +-half of this around the mean
  jitterHue:.45,    // per-blade warm/cool shift: red up and blue down by up to half of this
  clumpSize:.75,    // world units across one tuft: blades in a cell lean toward the cell's centre
  clumpLean:.55,    // how far the tips pull toward the tuft centre, as a share of the distance to it
  clumpShade:.3,    // tufts differ in lightness by up to half of this, so they read as separate clusters
  clumpHeight:.3,   // tufts differ in height by up to half of this (mean unchanged)
  tipCurl:.15,       // random per-blade bend of the upper half, in blade lengths (replaces one shared lean)
  patchScale:.03,   // frequency of the large colour drifts (1/30 units)
  patchTint:.5,     // warm/cool drift strength in the blade tips; the ground wears the same drift
  patchLight:.28,   // lighter/darker drift strength
  dryPatch:.3,      // how far dry straw-coloured patches pull the tips (a few, rare)
  cloverPatch:.35,  // how far brighter clover-green patches pull the tips (a few, rare)
  edgeScale:2.3,    // frequency of the ragged noise on the grass/path border (per unit)
  edgeNoise:.55,    // how far that noise moves where the border falls, in mask units (0..1 across the border)
  edgeHeight:.4,    // blade height at the very rim of the grass, as a share of full height (grows to 1 inside)
  edgeLean:.6,      // tips at the rim lean out over the path, in blade lengths
  pathShadow:.55,   // the ground at the path border darkens to this share of grass colour before turning to soil
  // Living wind (2026-11-17, owner: "feels like carpet when it moves"). Gusts are a noise field scrolling along one
  // direction; blades bend as arcs; bent grass catches sky light so a pale band travels with each gust. LOOK.wind
  // (uWind) multiplies everything; 0 on any strength below turns that effect off.
  windDir:-.6,     // direction the wind blows toward, radians in the ground plane (0 = +x, pi/2 = +z)
  gustScale:.032,   // frequency of the gust field along the wind, per unit (was .05; owner 2026-11-17: bands read as waves on water, so fronts are wider apart)
  gustSpeed:2.2,    // how fast gusts travel across the meadow, units per second (was 5.5; owner: "moving so fast")
  gustStretch:.45,  // across-wind frequency as a share of along-wind: below 1 stretches fronts sideways
  gustCalm:.45,     // gust field (0..1, a sum of smooth waves) below this is dead calm
  gustFull:.85,     // gust field at or above this is a full gust (strength 1); the wide ramp is the soft front, not an outline
  gustWarp:1.2,     // how far the front bends sideways along its length, radians of wave phase (0 = straight fronts)
  gustBend:1.05,    // tip bend angle at full gust, radians (blade arcs downwind and down)
  gustLift:1.3,     // blade-tip albedo gain at full gust (was 1.8, which striped the meadow light and dark; 0 = bent grass is not lighter)
  gustCalmDim:.07,  // tips darken by this much in dead calm (was .2: the dark troughs between gusts read as cloud shadows; 0 = no dimming)
  gustTint:.8,     // cool moon sheen added to bent tips at full gust (was 1.3, which went frosty teal-grey; 0 = none)
  breeze:.2,        // constant gentle sway of every blade, tip angle in radians
  breezeRate:1.1,   // breeze cycles speed, radians per second
  breezeWave:.35,   // breeze phase change along the wind, radians per unit (0 = whole field in step)
  flutter:.14,      // fast per-blade tip tremble at full gust, radians
  flutterRate:9,    // flutter speed, radians per second
  stiffSpread:.45,  // blades differ in stiffness: the stiffest bends this much less (0 = all alike)
  clumpWind:.2,     // share of the gust sampled at the tuft centre (was .6: square patches of blades switched together; 0 = each blade alone)
  clumpPhase:2.5,   // gust arrives this many units earlier or later per tuft, +-half (0 = tufts in step)
  windYaw:.5,       // each blade leans off the wind direction by up to half of this, radians
  // Handover (2026-11-17, owner: "I can see the grass appearing in the distance"). The fine tile ends in a circle that slid over
  // hills as the player walked. A coarse outer ring of fewer, bigger blades takes over where the fine blades sink, and the far
  // ground carries blade-like streaks, so no single boundary reads as a line. Units are world units from the focus (the player).
  ringCount:60000,      // coarse blades on desktop (0 = no ring)
  phoneRingCount:40000, // coarse blades on a phone
  ringTile:220,         // side of the coarse tile, so it reaches half of this (110 units)
  ringWidth:1.7,          // coarse blade width, times a fine blade
  ringHeight:1,        // tuft height scale before the shorter leaf profiles
  ringFrom:24,          // coarse blades are zero height inside this distance (the fine tile's full-detail zone); equals farFrom so one ramp starts as the other does
  ringFull:47,          // coarse blades reach full height here, exactly where the fine blades reach zero (tile/2 - 1). Was 76: between 47 and 76 the
                        // meadow was only part-grown, a low trough circling the player that made the ground seem to rise and fall while walking (owner, 2026-11-17)
  // Per-blade switch (2026-11-17, owner twice: "the ground is shrinking and moving while walking"). A shared 24..47 height ramp
  // meant every blade in the band was part-grown and changed height as the player moved. Now each blade has its own switch
  // distance (a hash of its seat) spread from farFrom to the tile edge: a fine blade is full height inside it and sinks over
  // switchSink past it, a coarse blade is zero inside it and full height switchSink past it. Only a thin scatter is mid-change.
  switchFrom:22,       // nearest switch distance for fine and coarse blades; the wider the spread, the fewer blades change per unit walked
  switchSink:3,        // distance over which one blade sinks or grows, world units
  switchMargin:1,       // the last fine blade is gone this far inside the tile half-width (they wrap there); matches the old tile/2-1
  switchCurve:1,        // spread of switch distances: 1 = even, above 1 = more switches near the player, below 1 = more near the tile edge
  ringFarFrom:70,      // coarse blades start to dissolve here, each at its own distance, the last near their tile edge (was 90 with a shared sink: a visible edge drew in while walking)
  ringFlat:.85,         // coarse blades' colour pulled toward the ground's (0 = full dark root to light tip, 1 = flat ground colour)
  ringDetail:.3,       // per-blade and per-tuft shading on coarse blades, as a share of the fine blades' (0 = flat colour)
  streak:.36,           // far-ground grass texture contrast (0 = smooth ground)
  streakScale:3,        // streak frequency across the wind, per unit (about 1/3 unit wide)
  streakStretch:.7,     // slight grain direction without long brushstrokes
  streakSway:0,         // the distant grass texture stays rooted when the wind moves
  streakNear:30,        // streaks start to show this far from the camera
  streakFull:60,        // streaks reach full strength here
  streakFadeFrom:110,   // streaks start to fade out here, so far ground never shimmers
  streakFadeTo:180,     // streaks are gone here
  // Noise octaves (2026-11-17, phone frame cost): the second, finer octave of the gust and streak noise is a share of it; 0 skips the octave.
  gustDetail:.35,        // share of the gust noise from the second octave (desktop)
  phoneWidthScale:1.25,  // phone: blades this much wider, so fewer blades keep the coverage
  phoneGustDetail:0,     // phone: one octave of gust noise (measured 0.0 ms on a desktop GPU; kept for ALU-bound phone GPUs)
  streakDetail:.35,      // share of the far-ground streak noise from the second octave (desktop)
  phoneStreakDetail:0};  // phone: one octave of streak noise
