(function(root){
  'use strict';
  // Swarm stage data (ledger #487). Every number the swarm model reads lives here; change a number here, nowhere else.
  // Provenance: the brief (ledger #487, owner 2026-11-19) fixes the two modes, the three kinds' roles, LIVE_CAP and SPAWN_RUNE_S.
  // The rest are first guesses tuned against studies/swarm-sim.test.cjs, which pins the clear time they must give.
  const MODES=Object.freeze({
    hunt:Object.freeze({goal:60}),   // defeat 60 monsters (brief #487)
    hold:Object.freeze({goal:120}),  // survive 120 seconds (brief #487)
    defense:Object.freeze({goal:5}), // clear 5 waves (owner picked defense 2026-11-20; D1 brief)
    bench:Object.freeze({goal:1e6}), // the frame-rate bench never ends: a goal no fight reaches (same reasoning as HELD_S, which is defined below)
  });
  // Frame-rate bench (?stage=swarm-bench&n=60; owner 2026-11-20: a defence mode of 30-60 monsters marching down, so measure first).
  const BENCH=Object.freeze({
    N_MIN:10,N_MAX:120,N_DEFAULT:60,  // n is clamped to 10..120; 60 is the top of the owner's 30-60 range
    PARAM:'n',                        // the URL parameter that carries n
    MARCH_SPEED:14,                   // arena units per second, every kind: slow, so a screen of them stays on screen for about 40 s
    WRAP_FROM:.85,                    // a monster whose y passes this share of the arena height returns to the top: above the heroes' starting band
    WINDOW_S:10,                      // the readout's rolling window, seconds (brief)
    LOW_SHARE:.01,                    // the "1% low" is the mean of the slowest 1% of frames
    SPREAD_X:.7548776662466927,SPREAD_Y:.5698402909980532, // R2 low-discrepancy steps (1/1.3247, 1/1.3247^2): an even, repeatable scatter with no dice
  });
  // Sprite cache (swarm-sprite-cache.js, swarm-sprites.js): each monster kind and pose is painted once to an offscreen canvas and drawn
  // with drawImage. A pose value is rounded to its step, so a continuous breathe or flap lands on a few reused sprites.
  const SPRITE=Object.freeze({
    CAP:700,            // sprites kept (least recently used leaves first): 3 kinds x about 9 poses x 16 phases is about 430, with room for a zoom
    SIZE_STEP:.02,        // device px per art unit is rounded UP to a step this share apart: the sprite is resampled by under this (2%, not visible)
    SQUASH_STEP:.025,   // a body's width and height scales are rounded to this (the breathe swings 5%, a hit squashes 12%)
    WING_STEP:.05,       // the sporemoth's wing angle, radians (the flap swings 0.32)
    PHASES:4,           // a sprite is painted at this many sub-pixel offsets per axis (quarter pixels), so blitting it on a whole pixel keeps the live drawing's edges
    FLASH_STEPS:4,     // the hit flash is drawn at this many levels above none
    PAD:.3,             // art units added round each kind's bounds, so a rim, a wing at full flap or a squash is never clipped
    BAR_STEPS:20,       // a health bar's fill share is rounded to 1/20, which at the bar's width is under a pixel
    WARM_PER_FRAME:2,   // hit sprites painted ahead per frame (lag fix 2026-11-20): a paint is about 1 ms at 4x throttle on the bench, so 2 stay well inside a frame; about 60 per kind and size finish in half a second
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
  // The model's tick rate (swarm-runtime.js beforeStep). The fight steps at 180 Hz; ticking the model on every step made the aim
  // forecast (720 steps) cost 25 ms of model time alone at 18 monsters (2026-11-20 bench). At 60 Hz the fastest monster (capling,
  // 70 units/s) moves 1.2 units a tick; the forecast only shows a path, so 30 Hz (2.3 units) is enough there.
  const TICK_S=1/60,FORECAST_TICK_S=1/30;
  // A killing hit plows through and gives back this share of the fling's travel budget (swarm-runtime.js collide). First guess,
  // set under the page's bumper top-up (FEEL.bumperRange .15) so a bumper still matters; tune by feel.
  const KILL_REFUND=.1;
  // Recoil (owner phone test 2026-11-20: "they dont recoil from my hits... the boss takes damage and recoil so it feels nice").
  // A hit that leaves a monster standing pushes it along the hero's flight, the push's speed falling by e every DECAY_S, and
  // pauses its march for STAGGER_S. Every value: first guess, tune by feel.
  const KNOCK=Object.freeze({
    DIST:Object.freeze({capling:26,sporemoth:20,mossback:8}), // arena units in all: about one drawn capling body (r 11 x 2.1 = 23); the tank least
    DECAY_S:.07,       // 95% of the push lands in .2 s: a snap, not a slide
    STAGGER_S:Object.freeze({capling:.3,sporemoth:.3,mossback:.15}), // the march pauses this long; the tank shrugs it off sooner
    STILL_SPEED:20,    // arena units per second: a hero slower than this pushes away from where it stands (a thrown hero flies 300+)
    STOP_SPEED:1,      // a push slower than this ends, so the state settles to exactly 0 (what is left is under .1 unit)
  });

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
  // Personal space, arena units: two live (or spawning) monsters keep their centres at least the sum of their kinds' SPACE
  // apart, so two never draw stacked into one blob (polish 2026-11-20: two sporemoths read as one). About 0.7 of each kind's
  // drawn half-width at ART.drawScale (capling cap 30, mossback 43, sporemoth body 17 and wings 43): rims may touch, faces
  // never stack. The capling's is .85 of its cap: at 22 a crowded Hold capture still read as one red heap. Movement only;
  // the hit radius r is unchanged.
  // Art round 2 (2026-11-20: about 8 caplings still read as one red pile): the capling's is half its drawn cap width (60), so
  // two caps meet rim to rim, and 4 passes hold that in a crowd (swarm-model.test.cjs "keeps capling caps countable").
  const SPACE=Object.freeze({capling:30,mossback:36,sporemoth:28});
  const SPACING_PASSES=4;            // relaxation passes per tick; 2 let a crowded Hold press caplings to 75% of their spacing
  // How far a live monster's centre stays in from the arena's sides, arena units: its drawn half-width at ART.drawScale
  // (capling 30, mossback 43, sporemoth 43), so no part of it is cut off (2026-11-20: a mossback clipped at the edge).
  const EDGE=Object.freeze({capling:31,mossback:44,sporemoth:43});
  // How far a live monster's centre stays down from the arena's top, arena units. Walkers rise far above their centre, so
  // the side inset would cut their cap or antlers (2026-11-20 review: a capling at y 31 lost over half its cap and its bar
  // went off screen). Each is the art's top plus the bar above it, less what the anchor sits below the centre:
  // ART.barTop x drawScale x r (+ LoftRumbleHudData.swarm.bar.gap 5 + ART.bar.h 10, - r for walkers, whose anchor is their
  // feet), rounded up: capling 64.06, mossback 63.84, sporemoth 53.22. swarm-model.test.cjs draws each kind at the clamp.
  const TOP_INSET=Object.freeze({capling:65,mossback:64,sporemoth:54});
  const REACH_SLACK=1e-7;            // spacing leaves a monster this far inside a hero's reach, so float error never voids its bite

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

  // Defense mode (owner picked it 2026-11-20; D1 brief). Monsters march on the crystal and bite it until it is gone.
  const DEFENSE_WAVES=Object.freeze([   // monsters per wave, per kind (D1 brief)
    Object.freeze({capling:10,sporemoth:2,mossback:0}),
    Object.freeze({capling:12,sporemoth:4,mossback:2}),
    Object.freeze({capling:14,sporemoth:6,mossback:4}),
    Object.freeze({capling:18,sporemoth:8,mossback:6}),
    Object.freeze({capling:25,sporemoth:12,mossback:8}),
  ]);
  const DEFENSE_LIVE_CAP=15;           // on screen at once; the rest wait in the wave's queue (crystal design, owner "build crystal" 2026-11-20: 30 -> 15, for the phone's frame rate)
  const DEFENSE_ENTRY_GAP_S=.25;       // seconds between two monsters entering at the top: a stream, not a clump (first guess, to tune by eye)
  // The crystal the swarm marches on (crystal design, ledger #501, owner "build crystal" 2026-11-20). x, y are shares of the arena
  // width and height, r a share of its width (the model turns them into arena units); the circle (y + r) stays well clear of the
  // bottom and side edges. Every number: first guess, the owner tunes by feel. hp 100 is the old team pool, so the bar still reads as a percentage.
  const CRYSTAL=Object.freeze({x:.5,y:.85,r:.075,hp:100});
  // Crystal HP one bite costs, per kind: the old leak costs (3/4/10) fell on a one-off pass; a monster now bites every second, so
  // each bite is a fraction of that (first guesses, tuned by feel): a tank bites hardest, a swarmer least.
  const CRYSTAL_BITE=Object.freeze({capling:1,sporemoth:1.5,mossback:3});
  const CRYSTAL_BITE_CD_S=1;           // seconds between one monster's bites (design default, owner can overrule)
  // Arena units per second toward the crystal centre. First set as the straight-down pace to the old leak line (D1 brief): capling
  // 44 about 12 s, mossback 21 about 25 s; the sporemoth's 30 is in between (first guess). The crystal is closer, so each arrives sooner.
  const DEFENSE_MARCH=Object.freeze({capling:44,mossback:21,sporemoth:30});
  const DEFENSE_FLIERS=Object.freeze(['sporemoth']); // fliers ignore spacing with ground kinds (D1 brief)

  // Code-drawn monster art (owner 2026-11-20: "u can draw art using code now"), read by swarm-monster-art.js.
  // Designs follow LOFT-RUMBLE-ASSET-PROMPTS.md lm_enemy_capling, lm_enemy_mossback, lm_enemy_sporemoth and lm_enemy_bar.
  // Every shape is in units of the monster's hit radius r, +y down; walkers' origin is the ground contact under the feet,
  // the flyer's is its body centre. Light from the upper left (the shared header). LOOK: every number here is a pick for
  // the owner's look round, not measured.
  const DRAW_GROW=1.4;               // polish 2026-11-20: every monster draws 1.4x its first code-art size (see ART.drawScale)
  const ART=deepFreeze({
    // Each colour role has a light, a base and a dark tone: radial gradient light -> base -> dark, rim in dark.
    palette:{
      capling:{body:'#d8402f',light:'#ff8a6a',dark:'#7e1d14',             // the prompt's glossy red cap #D8402F
        stem:'#ecd2a8',stemLight:'#fff3dc',stemDark:'#9c7448',spot:'#fff1d0', // tan stem, cream spots (palette cream #FFF1D0)
        moss:'#5e7a3a',mossLight:'#94b85a',mossDark:'#2f4320'},              // palette moss mineral #5E7A3A
      mossback:{body:'#7a4a30',light:'#b9825a',dark:'#3b2a1e',               // reddish-brown bark; dark = palette bark root #3B2A1E
        moss:'#5e7a3a',mossLight:'#9cc25e',mossDark:'#2f4320',leaf:'#a8d46a',
        eye:'#f5a623',eyeCore:'#ffe7a3',antler:'#c08a58',antlerDark:'#4a2c18'},                 // amber eyes = palette special amber #F5A623
      // Art round 2 (2026-11-20: read as a dark purple spiky bug): lighter than the prompt's #9C7BD6 so the canvas shading lands
      // on it, and lighter leaf wings so they read see-through over the sand.
      sporemoth:{body:'#c4adf0',light:'#f4ecff',dark:'#8a6cc8',
        wing:'#a8e07c',wingLight:'#e6ffc4',wingDark:'#5f9e48',vein:'#f6ffe6',
        antenna:'#3e2a5e',bulb:'#efe4ff'},
      face:{ink:'#24141c',white:'#fffaf0',fang:'#fffaf0'},
      outline:'#24160e',  // the bark-dark line the painted residents are outlined in; each rim is its dark tone mixed toward it
      shadow:'#1e120a',
      flash:'#ffffff',
      bar:{rim:'#3b2a1e',lit:'#c79a64',channel:'#2a0f22',                   // bark root rim, lit top-left edge, deep plum channel
        rose:'#e23a6e',roseDeep:'#9e1f48',core:'#ffc6d8'},                   // palette enemy rose #E23A6E, pale pink core line
    },
    // Polish 2026-11-20 (visual check: lighter rim and shading than the painted residents, so they read flat): rim 1.6 -> 2.4 px
    // and inked toward palette.outline, shadow .3 -> .55.
    rimPx:2.4,          // the dark rim's width in canvas px at 1x, whatever the monster's size
    rimInk:.6,          // how far each rim moves from its dark tone toward palette.outline
    highlightAlpha:.5,  // the soft top-left highlight on each body
    shadowAlpha:.55,    // the contact shadow's opacity
    shadowGrow:1.15,    // the contact shadow's size against the shape data's oval, so it spreads past the feet
    lightAt:{x:-.35,y:-.4}, // the gradient's light point as a share of a shape's radii, toward the upper left
    // Silhouette boxes (w, h in r) for the bar's place and the distinct-silhouette check: a dome on a stem, a low wide
    // ridge with antlers, a wide pair of wings.
    bounds:{capling:{w:2.6,h:2.5,anchor:'feet'},mossback:{w:2.8,h:1.9,anchor:'feet'},sporemoth:{w:4.7,h:3.1,anchor:'centre'}},
    // Draw size as a multiple of the hit radius r, per kind. Drawing only: the hit radius (KINDS.r) is untouched. The capling
    // read about 18 px across on a 390 x 844 phone at 1 (its cap 27 px, the body under it far less); 1.5 gave a 41 px cap
    // there and kept it the smallest of the three. Polish 2026-11-20: every kind x DRAW_GROW (1.4), since at 1.5 / 1 / 1 the
    // monsters were about 30 px wide on the phone and lacked the residents' weight. LOOK: all three.
    drawScale:{capling:1.5*DRAW_GROW,mossback:DRAW_GROW,sporemoth:DRAW_GROW},
    // Motion. Walkers breathe (squash and stretch about the feet), the flyer bobs and flaps. Reduced motion: none of it.
    breatheHz:1.1, breatheAmp:.05, bobHz:1.4, bobAmp:.18, flapHz:3.2, flapAmp:.32, // flapAmp in radians
    phaseSpread:.618,   // per-monster phase step (golden ratio), so a crowd does not breathe in step
    hitFlashS:.16,      // the white flash after a hit
    flashMix:.75,       // how far toward white the flash's peak goes, so the face still reads through it
    hitSquash:.18,      // the extra width at the flash's peak, full motion only; .12 -> .18 with the recoil (owner 2026-11-20: hits must feel tactile), first guess, tune by feel
    // The defeat pop (polish 2026-11-20: at .45 grow and a leaf puff alone it read as faint green leaves on a phone).
    popGrow:.7,         // a defeated monster grows by this share while it fades (DYING_S); reduced motion only fades
    popWhite:.3,        // the first share of the defeat draws the monster as a white silhouette (reduced motion too: no movement)
    // Sparks thrown out of the pop. Distances in drawn half-widths of the monster, size in r. Reduced motion holds them at `hold`.
    burst:{sparks:10,from:.5,to:1.5,hold:1.1,size:.26,colour:'#fff4c8',core:'#ffffff',spin:.3},
    // The enemy bar (lm_enemy_bar): a thick rim round a plum channel, the rose fill inside. Canvas px at 1x, origin at the
    // bar's bottom centre. The gap above the silhouette's top is LoftRumbleHudData.swarm.bar.gap.
    // Art round 2 (2026-11-20: a ~20 px sliver): the prompt's 48 x 7, a px taller so the fill reads at phone size.
    bar:{w:48,h:10,rim:2.5,litWidth:1.2,coreWidth:1.4},
    // Where the bar sits, in drawn r above the anchor: the highest point the kind's art reaches under the bar in any
    // full-motion pose (breathing, bob, flap), measured by swarm-monster-art.test.cjs.
    barTop:{capling:2.6,mossback:2.3,sporemoth:2.1},
    capling:{
      shadow:{x:0,y:0,rx:1.05,ry:.3},
      legs:[{x:-.36,y:-.14,rx:.26,ry:.2},{x:.36,y:-.14,rx:.26,ry:.2}],
      stem:{x:0,y:-.72,rx:.74,ry:.66},
      eyes:[{x:-.26,y:-.74,r:.17},{x:.26,y:-.74,r:.17}],pupil:.09,look:.06,
      brows:[{x1:-.5,y1:-.98,x2:-.1,y2:-.86},{x1:.5,y1:-.98,x2:.1,y2:-.86}],browWidth:.13,
      fangs:[{x:-.12,y:-.42},{x:.12,y:-.42}],fangW:.09,fangH:.15,
      mouth:{x:0,y:-.44,w:.36,h:.06},
      collar:{x:0,y:-1.26,rx:.84,ry:.14,lumps:7,lumpR:.12},
      cap:{x:0,y:-1.42,rx:1.3,ry:1.02,lip:.3},
      spots:[{x:-.62,y:-1.82,r:.2},{x:.18,y:-2.12,r:.24},{x:.72,y:-1.66,r:.17},{x:-.12,y:-1.6,r:.13}],
      shine:{x:-.52,y:-2.02,rx:.32,ry:.16},
    },
    mossback:{
      shadow:{x:0,y:0,rx:1.38,ry:.3},
      legs:[{x:-.98,y:-.12,rx:.2,ry:.18,back:true},{x:.98,y:-.12,rx:.2,ry:.18,back:true},
        {x:-.5,y:-.06,rx:.22,ry:.16},{x:.5,y:-.06,rx:.22,ry:.16}],
      // Art round 2 (2026-11-20: read as a green turtle): a lower mantle, a big head facing the viewer, pale forked antlers
      // with a dark casing that rise well clear of the moss, and larger inked amber eyes.
      shine:{x:-.48,y:-1.34,rx:.2,ry:.09}, // on the mantle's top-left lump, where the light lands
      body:{x:0,y:-.72,rx:1.3,ry:.62},
      ridges:[{x:0,y:-.6,rx:1.05,ry:.36},{x:0,y:-.48,rx:.82,ry:.26}],ridgeWidth:.06,
      mantle:[{x:-.86,y:-.94,r:.34},{x:-.42,y:-1.14,r:.42},{x:.62,y:-1.06,r:.38},{x:1.0,y:-.82,r:.26}],
      leaves:[{x:-.62,y:-1.48,a:-.6},{x:.86,y:-1.38,a:.9}],leafL:.22,leafW:.09,
      head:{x:.1,y:-.7,rx:.64,ry:.5},
      antlers:[{root:{x:-.2,y:-1.06},tip:{x:-.5,y:-2.06},fork:{x:-.9,y:-1.72}},{root:{x:.4,y:-1.06},tip:{x:.7,y:-2.06},fork:{x:1.1,y:-1.72}}],
      antlerWidth:.16,antlerCase:.08,forkAt:.48,
      eyes:[{x:-.14,y:-.72,r:.17},{x:.34,y:-.72,r:.17}],eyeCore:.07,
      brows:[{x1:-.38,y1:-1.0,x2:-.02,y2:-.9},{x1:.58,y1:-1.0,x2:.22,y2:-.9}],browWidth:.13,
      mouth:{x:.1,y:-.4,w:.22,h:.08},
    },
    sporemoth:{
      hover:1.6,          // the flight shadow sits this far below the body centre
      shadow:{rx:.95,ry:.26},
      wings:[{root:{x:.28,y:-.15},tip:{x:2.3,y:-1.3},width:.95},{root:{x:.3,y:.25},tip:{x:1.55,y:1.05},width:.6}],
      wingAlpha:.55,veinWidth:.07,veinTurns:1.5,veinR:.36,veinAt:.55, // round 2: .82 -> .55, the sand shows through
      fuzz:{r:.92,lumps:20,lumpR:.17,back:.1}, // round 2: soft lumps with no rim of their own round a rimmed backing disc (r + back)
      body:{x:0,y:0,r:.92},
      antennae:[{root:{x:-.24,y:-.82},bend:{x:-.3,y:-1.35},tip:{x:-.62,y:-1.62}},{root:{x:.24,y:-.82},bend:{x:.3,y:-1.35},tip:{x:.62,y:-1.62}}],
      antennaWidth:.08,bulb:.15,
      eyes:[{x:-.3,y:-.08,r:.17},{x:.3,y:-.08,r:.17}],pupil:.1,look:.05,
      brows:[{x1:-.52,y1:-.4,x2:-.12,y2:-.24},{x1:.52,y1:-.4,x2:.12,y2:-.24}],browWidth:.11,
      mouth:{x:0,y:.3,w:.2,h:.06},
    },
  });
  function deepFreeze(o){for(const v of Object.values(o))if(v&&typeof v==='object')deepFreeze(v);return Object.freeze(o)}

  const api=Object.freeze({MODES,BENCH,SPRITE,SWARM_LIVE,ARENA,SPAWN_BAND,SPAWN_MIN_HERO_DIST,FIRST_SPAWN_S,LIVE_CAP,SPAWN_RUNE_S,DYING_S,MAX_DT,TICK_S,FORECAST_TICK_S,KILL_REFUND,KNOCK,LAB_SEED,HELD_S,
    KINDS,IDS,SPACE,SPACING_PASSES,EDGE,TOP_INSET,REACH_SLACK,TELEGRAPH_S,SHOT_SPEED,SHOT_R,SHOT_DAMAGE,RAMP,ART,
    DEFENSE_WAVES,DEFENSE_LIVE_CAP,DEFENSE_ENTRY_GAP_S,CRYSTAL,CRYSTAL_BITE,CRYSTAL_BITE_CD_S,DEFENSE_MARCH,DEFENSE_FLIERS});
  root.LoftRumbleSwarmData=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
