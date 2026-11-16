// Living-magic HUD (LM6b): the owner's ui-v1 boss and team health frames, health fill and combo ornament in the live fight.
// Numbers only; layout in rumble-hud-model.js, drawing in rumble-hud.js, hero cards in rumble-hud.css.
// Spec: docs/design/LOFT-RUMBLE-LIVING-MAGIC.md ("HUD, bumpers and unfinished art", "UI pack v1");
// art and composition rules: assets/living-magic/ui-v1/README.md. Lengths are logical arena units (the arena is 360 wide).
(function(root){
  'use strict';
  root.LoftRumbleHudData=Object.freeze({
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
      nameFont:15,hpFont:12,
    }),
    // Team frame: visible 0.281-0.719 tall; the trough right of the empty left socket runs 0.107-0.935 wide, 0.393-0.6 tall.
    // The socket (centre 0.082, 0.5; 0.042 of the width across) holds the spiral seed.
    team:Object.freeze({
      visibleTop:.281,visibleBottom:.719,
      channel:Object.freeze({x:.107,y:.405,w:.826,h:.18}),
      socket:Object.freeze({x:.082,y:.5,size:.042}),
      numberGap:6,       // between the frame's right end and the live "HP/max" readout
      numberFont:12,
      seedScale:1.25,    // the seed reads a little larger than the socket opening, as on boss-layout.webp
    }),
    // The fill: the top share that catches the upper-left light and how strongly; hud-health-fill's luminous strand spans
    // 35 of the texture's 77 rows (alpha bbox), so it is drawn that much taller than the channel to fill it.
    fill:Object.freeze({sheen:.45,sheenAlpha:.22,strandBand:35/77}),
    inset:8,            // the frames' distance from the arena's side edges
    type:Object.freeze({body:15,helper:13}), // UI standards L11, in CSS pixels
    pixels:Object.freeze({channels:4,alpha:3}), // Canvas ImageData RGBA byte layout
    compactScale:.75,   // below this, omit the redundant boss number to preserve the centred name
    topStrip:50,        // existing page hudTop; layout must not change the combat bounds
    // Combo: a compact cream count on the left edge inside the open spiral ornament (boss-layout.webp, "9 HITS").
    combo:Object.freeze({
      x:8,y:118,         // ornament's top-left; y clears the boss header and the intent chip's highest row
      width:46,          // ornament draw width; height follows its 192 x 174 texture
      countFont:20,labelFont:10,labelGap:11,
      milestonePop:.45,  // scale a milestone hit adds at its peak, on the page's own hit-pop clock (comboPopLife)
    }),
    // Stroke round live text so cream reads on any of the three arena backgrounds (L9).
    textStroke:3,
    scrimAlpha:.55,      // top-of-arena shade behind the boss header, fading out by the strip's bottom
    tokens:Object.freeze({
      cream:'--hud-cream',ink:'--hud-ink',boss:'--hud-boss-fill',team:'--hud-team-fill',pending:'--hud-pending',
      scrim:'--hud-scrim',flash:'--hud-flash',low:'--danger',
    }),
    // Canonical portraits for the three dock slots. The third slot is the demo's resident (rumble-demo-data.js, Puff); a
    // card with its own art (data-own-art) keeps it, so player-made residents use the same frame and pipeline.
    portraits:Object.freeze({sprout:'lm-portrait-sprout',chomper:'lm-portrait-chomper',custom:'lm-portrait-puff'}),
    nameFit:Object.freeze({min:13,step:.5}),  // L11 helper-text floor, the name's own floor (rumble-hud.css --hud-name-floor); then ellipsis
  });
})(globalThis);
