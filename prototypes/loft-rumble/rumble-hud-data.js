// Living-magic HUD (LM6b): the owner's ui-v1 boss and team health frames, health fill and combo ornament in the live fight.
// Numbers only; layout in rumble-hud-model.js, drawing in rumble-hud.js, hero cards in rumble-hud.css.
// Spec: docs/design/LOFT-RUMBLE-LIVING-MAGIC.md ("HUD, bumpers and unfinished art", "UI pack v1");
// art and composition rules: assets/living-magic/ui-v1/README.md. Lengths are logical arena units (the arena is 360 wide).
(function(root){
  'use strict';
  root.LoftRumbleHudData=Object.freeze({
    // The arena canvas's backing store stops at 2 device pixels per CSS pixel (#507). A 3x phone filled 9 bitmap pixels per
    // CSS pixel, and the cap cut the frame's 95th percentile from 183 to 67 ms (390x844, CPU 4x, 2026-11-20).
    maxCanvasDpr:2,
    art:Object.freeze({
      bossFrame:'lm-hud-boss-frame',teamFrame:'lm-hud-team-frame',fill:'lm-hud-health-fill',
      combo:'lm-hud-combo-ornament',seed:'lm-hud-spiral-seed',
    }),
    // Texture sizes in pixels (ui-v1/manifest.json). The frames scale uniformly: the crest and endcaps forbid stretch slicing.
    textures:Object.freeze({
      bossFrame:Object.freeze({w:1024,h:172}),teamFrame:Object.freeze({w:1024,h:135}),combo:Object.freeze({w:192,h:174}),
    }),
    // Boss frame, normalised to its texture. Measured from alpha and the plum trough (2026-11-15): crest top 0.221, visible
    // bottom 0.779, trough 0.494-0.686 tall and 0.046-0.957 wide. The README's candidate channel (y 0.57, h 0.20) ran past the
    // lower lip, so the channel sits one pixel inside the measured trough on each side.
    boss:Object.freeze({
      crestTop:.221,visibleBottom:.779,channel:Object.freeze({x:.058,y:.505,w:.888,h:.17}),
      width:330,         // frame width: keeps the crest-to-lip band inside the 50-unit top strip with the name above it
      nameBaseline:17,   // the centred boss name; the crest starts nameGap below it
      nameGap:2,
      nameFont:15,hpFont:13, // hpFont at the helper floor (type.helper; audit finding 3)
    }),
    // Shield health bar (owner's 2026-11-18 round 5 feedback, #439: the on-arena bar read as a sign, not a health bar):
    // a thinner bar hanging from the boss frame's lower lip, centred under the boss channel. share: its width as a share
    // of the boss channel; height and edge (the ink outline that carries 3:1 on any frame or floor) in arena units;
    // tuck: how far it rises onto the frame's lip so it reads as part of the frame; labelGap: the "Shield" word's gap
    // left of the bar; labelFont at the helper floor (type.helper). Look round pick, owner to judge.
    shield:Object.freeze({share:.5,height:5,edge:1.5,tuck:2,labelGap:6,labelFont:13}),
    // Team frame: visible 0.281-0.719 tall; the trough right of the empty left socket runs 0.107-0.935 wide, 0.393-0.6 tall.
    // The socket (centre 0.082, 0.5; 0.042 of the width across) holds the spiral seed.
    team:Object.freeze({
      visibleTop:.281,visibleBottom:.719,
      channel:Object.freeze({x:.107,y:.405,w:.826,h:.18}),
      socket:Object.freeze({x:.082,y:.5,size:.042}),
      numberGap:6,       // between the frame's right end and the live "HP/max" readout
      numberFont:13,     // the helper floor (type.helper; audit finding 3)
      seedScale:1.25,    // the seed reads a little larger than the socket opening, as on boss-layout.webp
    }),
    // The fill: the top share that catches the upper-left light and how strongly; hud-health-fill's luminous strand spans
    // 35 of the texture's 77 rows (alpha bbox), so it is drawn that much taller than the channel to fill it.
    // Keep hit washes translucent: an opaque white bar erases both its health colour and moving strand.
    fill:Object.freeze({sheen:.45,sheenAlpha:.22,strandBand:35/77,strandAlpha:.45,flashMax:.55}),
    // LOOK: two tapered sap filaments, with a soft shoulder; lengths relative to the full channel.
    // Slow travel stays on presentation time. Each repeat wraps wholly outside the channel.
    energy:Object.freeze({period:16000,phase:.25,count:2,length:.32,segments:32,
      amplitude:.22,ripple:.07,waves:.65,phaseGap:1.7,drift:.35,
      coreWidth:.18,haloWidth:.42,coreAlpha:.82,haloAlpha:.16,feather:.35}),
    // Ready-frame nine-slice source edges, matching ui-v1's 480 x 400 texture.
    energySlices:Object.freeze({x:Object.freeze([0,100,380,480]),y:Object.freeze([0,110,300,400])}),
    inset:8,            // the frames' distance from the arena's side edges
    type:Object.freeze({body:15,helper:13,weight:600}), // UI standards L11, in CSS pixels; weight is the bundled Nunito's top (rumble-tokens.css)
    pixels:Object.freeze({channels:4,alpha:3}), // Canvas ImageData RGBA byte layout
    compactScale:.75,   // below this, omit the redundant boss number to preserve the centred name
    topStrip:50,        // existing page hudTop; layout must not change the combat bounds
    // Combo: a compact cream count on the left edge inside the open spiral ornament (boss-layout.webp, "9 HITS").
    combo:Object.freeze({
      x:8,y:118,         // ornament's top-left; y clears the boss header and the intent chip's highest row
      width:46,          // ornament draw width; height follows its 192 x 174 texture
      countFont:20,labelFont:13,labelGap:12, // label at the helper floor (audit finding 3); the gap grows with it
      milestonePop:.45,  // scale a milestone hit adds at its peak, on the page's own hit-pop clock (comboPopLife)
    }),
    // Stroke round live text so cream reads on any of the three arena backgrounds (L9).
    textStroke:3,
    scrimAlpha:.55,      // top-of-arena shade behind the boss header, fading out by the strip's bottom
    tokens:Object.freeze({
      cream:'--hud-cream',ink:'--hud-ink',boss:'--hud-boss-fill',team:'--hud-team-fill',pending:'--hud-pending',
      bossEnergy:'--hud-boss-energy',teamEnergy:'--hud-team-energy',
      scrim:'--hud-scrim',flash:'--hud-flash',low:'--danger',
      shield:'--hud-shield-fill',shieldTrack:'--hud-shield-track',ready:'--hud-ready',
    }),
    // Swarm stage (ledger #487 U3): monsters, their small bar, spawn rune, spit ring and the boss-plate counter.
    // Drawing in swarm-view.js; the counter in rumble-hud.js. Lengths are arena units. Marked LOOK: picks for the
    // owner's look round, not measured.
    swarm:Object.freeze({
      // The monsters and their bar are code-drawn (swarm-monster-art.js; sizes in LoftRumbleSwarmData.ART), so only the two
      // painted effects have art keys.
      art:Object.freeze({
        puff:'fx-leaf-puff',seed:'fx-seed-projectile',   // existing effects reused (brief #487 U3)
      }),
      // The small health bar sits this far above the monster's silhouette. LOOK: gap.
      bar:Object.freeze({gap:5}),      // art round 2 (2026-11-20): 3 read as touching the sporemoth's antennae
      // Spawn rune, code geometry like the danger rings. Radius as a share of the monster's r; it grows from `from` to
      // full over SPAWN_RUNE_S (LoftRumbleSwarmData). spin in radians per second, never under reduced motion. LOOK: all.
      // U5 browser pass: 1.6 from .4 width 2 was a 7-17 px hairline gone before the eye found it on a 390 px phone.
      rune:Object.freeze({radius:2.4,from:.6,width:3,ticks:6,tick:.35,spin:1.5,alpha:.9}),
      // Spit telegraph ring round the spit's origin, radius a share of the shot's r; pulse in Hz between alphaMin and 1,
      // a steady ring under reduced motion. aim: the line toward where the seed flies, as seconds of its flight speed.
      // U5 browser pass: radius 2.2 (13 px) sat inside the 64 px sporemoth sprite and never showed; 5 rings the sprite. LOOK: all.
      // U6: the pink core alone measured 1.34:1 on the arena sand (sampled rgb 230 165 106 from the phone spit capture), under
      // the 3:1 WCAG non-text floor. caseWidth: a steady --rumble-danger-deep casing under the core, 2 px proud each side; the
      // casing measured 4.54:1 against the same sand. LOOK: caseWidth.
      telegraph:Object.freeze({radius:5,width:3,caseWidth:7,pulse:4,alphaMin:.45,aim:.5}),
      // Death puff: fx-leaf-puff at the art renderer's leafSize (art-manifest.js metrics, 46), growing from `from` to `to`
      // over `seconds` while the sprite fades; reduced motion keeps size 1 and only fades. LOOK: seconds, from, to.
      puff:Object.freeze({size:46,seconds:.35,from:.7,to:1.4}),
      seed:Object.freeze({size:2.4}), // flying seed draw size as a multiple of the shot's r. LOOK
      // The counter fills with the team's own colour: progress toward the win is the team's, not the boss's. LOOK
      counterMax:100,     // the counter bar's scale; frac 0..1 maps onto it so the shared channel draws it
      secondsPerMinute:60,
      // Defense (D2, owner pick 2026-11-20): kills are the score, so the count stands alone and large at top centre, with one
      // dot per wave under it and no plate. Everything stays inside the 50-unit top strip (topStrip), above the highest
      // monster centre (LoftRumbleSwarmData.TOP_INSET, sporemoth 54). LOOK: all sizes, the owner's look round.
      defense:Object.freeze({
        countFont:30,countBaseline:31,   // cap height ~0.7 of the font, so the digits run from about y 10 to 31
        // Centre row, radii, centre-to-centre gap, ink outline width. Round 1 on a 390 px phone: radius 3.5 read as specks.
        // dotRing: the cream rim of a wave still to come, so the dark slot reads over antlers and caps too.
        dotY:41,dotR:4.5,currentR:6,dotGap:19,dotEdge:1.5,dotRing:1.5,
        // Lull cue: "Wave 3" over the seconds left, centred at cueY, below the counter and above where a wave walks in.
        // pop: extra scale on each new second, easing out over popShare of that second; never under reduced motion.
        cueY:150,cueFont:20,cueCountFont:34,cueGap:30,pop:.3,popShare:.25,
        copy:Object.freeze({wave:'Wave {n}'}),
        // Dot colour per state, as keys of `tokens` above: held waves in amber, the current one cream, waves to come dark.
        dots:Object.freeze({done:'ready',current:'cream',next:'shieldTrack'}),
      }),
      tokens:Object.freeze({rune:'--rumble-amber',telegraph:'--danger',telegraphCase:'--rumble-danger-deep',ink:'--hud-ink'}),
      // The defense crystal's look (C3 design, ledger #501, owner "build crystal" 2026-11-20; drawing in swarm-view.js). Where and
      // how big come from state.crystal (arena units, set by the model from LoftRumbleSwarmData.CRYSTAL); this is only the look.
      // Shapes are in units of the crystal's r, +y down, origin at its centre. LOOK: every number, the owner's look round.
      crystal:Object.freeze({
        // Colour roles, CSS custom properties defined in the page's :root. A cool aqua gem: the arena is warm sand, the monsters
        // red, bark and lilac, the heroes' rings green, plum and blue, so the thing to protect is the only cyan on the field.
        tokens:Object.freeze({light:'--crystal-light',face:'--crystal-face',deep:'--crystal-deep',ink:'--crystal-ink',
          crack:'--crystal-crack',flash:'--crystal-flash',shadow:'--crystal-shadow'}),
        // Crack stage by HP share: above `cracked` whole, above `badly` cracked, else badly cracked (the design's HP thirds).
        cracked:2/3,badly:1/3,
        // Drawn at drawScale x the model's r, like the monsters' ART.drawScale: at 1 the gem was about 40 px across on a 390 px
        // phone, smaller than one capling (browser pass 2026-11-20). Drawing only: biters still stop at the model's r.
        drawScale:1.35,
        flashS:.18,flashAlpha:.85,  // a bite's white flash over the gem, seconds of fight clock (a pause holds it) and its peak opacity
        inkPx:2.4,                  // outline width in canvas px, as the monsters' rimPx (LoftRumbleSwarmData.ART)
        crackCasePx:3.6,crackPx:1.6, // a crack is a dark casing with a pale core, so it reads on the light and the deep facets alike
        shadow:Object.freeze({y:.74,rx:1.15,ry:.3,alpha:.4}), // the contact shadow on the sand under the cluster
        // One gem: a pointed shard with a top bevel and two side facets split at the ridge (x 0). Side shards reuse it.
        gem:Object.freeze({tip:[0,-1.1],shoulder:[.46,-.58],hip:[.46,.42],base:[0,.74],bevel:[0,-.4]}),
        // Side shards behind the main one: offset, turn (radians), scale. Stage 2 breaks the right one to a stub.
        sides:[{at:[-.56,.34],turn:-.5,scale:.56},{at:[.6,.3],turn:.55,scale:.64}],
        stub:[[-.46,-.08],[-.12,-.3],[.18,-.06],[.46,-.24],[.46,.42],[0,.74],[-.46,.42]], // the broken right shard, gem units
        // Stage 2 snaps the main shard's tip to this jagged crown, between the two shoulders. Browser pass 2026-11-20: in a full
        // surround the biters in front hide the lower half, so every stage must read from the top half.
        snapped:[[-.2,-.86],[-.06,-.7],[.12,-.93]],
        // Crack polylines on the main shard, gem units, weighted to the top half for the same reason. Stage 1 draws the first;
        // stage 2 draws all.
        cracks:[
          [[-.46,-.45],[-.2,-.5],[-.1,-.3],[.15,-.33],[.3,-.1]],
          [[.46,-.2],[.22,-.05],[.28,.18]],
          [[-.46,.1],[-.22,.22],[-.12,.5]],
          [[-.18,-.8],[-.08,-.62],[.06,-.52]],
        ],
      }),
      // A hero's ring in swarm mode (C3, #507): a pool of light on the ground at the hero's feet in its dock surface colour (the
      // dock card's --hero-surface, read by the page), so the owner finds his hero in a crowd. Drawn on the ground layer, so the
      // hero and the monsters beside it stand on it. Owner 2026-11-20: the earlier disc behind the body "looks bad".
      // Units are shares of the hero's body radius r. footY: the centre's drop below the body centre, to the art's feet.
      // rx: half-width; squash: height over width, the foreshortened ground. glow: steps nested ellipses, each at alpha, so
      // the light builds to the centre and fades outward. rim: a thin brighter line at `at` of the glow's size.
      // colour: which dock colour each part takes. The surfaces are near white (rumble-tokens.css), so the glow takes the ink,
      // the only tone that tells Sprout, Chomper and Puff apart on the sand; the rim takes the pale surface, the bright edge.
      // breathe: with full motion the light swells by amp of its alpha once per periodS; reduced motion holds it still.
      heroRing:Object.freeze({footY:.78,rx:1.15,squash:.36,glow:Object.freeze({steps:5,alpha:.13,colour:'ink'}),
        rim:Object.freeze({at:.94,width:2,alpha:.9,colour:'surface'}),breathe:Object.freeze({periodS:2.8,amp:.18})}),
    }),
    // Canonical portraits for the three dock slots. The third slot is the demo's resident (rumble-demo-data.js, Puff); a
    // card with its own art (data-own-art) keeps it, so player-made residents use the same frame and pipeline.
    portraits:Object.freeze({sprout:'lm-portrait-sprout',chomper:'lm-portrait-chomper',custom:'lm-portrait-puff'}),
    nameFit:Object.freeze({min:13,step:.5}),  // L11 helper-text floor, the name's own floor (rumble-hud.css --hud-name-floor); then ellipsis
  });
})(globalThis);
