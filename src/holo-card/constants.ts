// Tunables for the holographic resident card (look test `?holocard`, 2026-11-19). The game has no shared debug
// panel (window-fx has its own, for the window only), so the numbers the owner tunes live here. Each is a starting
// value for the owner to judge from a capture, not a measured one, unless its comment names a source.

export const HOLO_TUNE = {
  /** Degrees the card tips at the card's edge. A card held and tipped in the hand turns about 10 to 20 degrees; 14
   *  keeps the ability lines readable at the 390 px phone width (judged on the first capture round). */
  tiltMax: 14,
  /** Spring pull toward the pointer, per second squared. 170 with damping 26 is the conventional "default" spring
   *  in UI animation libraries: settles in about 0.4 s with one small overshoot. */
  stiffness: 170,
  /** Spring friction, per second. See `stiffness`. */
  damping: 26,
  /** Opacity of the foil at full tilt, 0 to 1. Starting value; color-dodge blows out above about 0.9. */
  shineStrength: 1, // holo redo 2: 0.75 still read as no foil to the visual checker
  /** Opacity of the pointer glare at full tilt, 0 to 1. Starting value. */
  glareStrength: 0.85,
  /** How much foil shows on a card at rest, as a share of `shineStrength`, so the foil reads before anyone touches it. */
  restShine: 0.35, // holo redo: restrained at rest; the band brightens as the card tips
  /** Percent the foil's band of light moves across the card for a pointer moving edge to edge. Holo redo: 60, so
   *  the band sweeps a third of the card each way; the old 40 cap was for a visible pattern sliding off the card. */
  shineTravel: 60,
} as const;

/** The foil's tint comes from the painting (holo redo, 2026-11-20): the three most common hues among its colourful
 *  pixels, each set to one saturation and lightness so every card's foil has the same strength. */
export const FOIL_TINT = {
  /** Hue bins, degrees wide: 30 gives 12 families (red, orange, yellow, ...), coarse enough that one painted
   *  colour with its shading lands in one bin. */
  binDegrees: 30,
  /** A pixel counts only when this opaque (0 to 255): skips the cut-out's transparent surround. */
  minAlpha: 128,
  /** HSL saturation and lightness (0 to 1) a pixel needs to count: greys, near-blacks and highlights carry no hue. */
  minSaturation: 0.25,
  minLightness: 0.12,
  maxLightness: 0.9,
  /** The foil colours' saturation and lightness, percent. Mid lightness: color-dodge divides by (1 - foil), so a
   *  pastel blows out to white (round 1). Holo redo 3: 72%, since 55% read as no colour in a mid-tilt capture. */
  saturation: 72,
  lightness: 50,
  /** A family counts only this many degrees or more from every one already chosen (first redo capture: Chomper's
   *  purple painting gave three purples, and a one-hue foil reads as no foil). */
  minSpread: 60,
  /** A painting with fewer than three hue families fills the rest with neighbours of its first, this many degrees on. */
  fillStep: 90,
  /** Gold and cyan join the painting's main hue in the bands (holo redo 2): the colours a printed holo flashes, and
   *  far enough from most paintings to show on them. Round 1's painting-only hues vanished into dark art (Chomper). */
  accents: [45, 190],
  /** A painting with no colourful pixel: lamplight gold, leaf green and dusk violet. */
  fallback: [40, 140, 270],
} as const;

/** Where a reduced-motion card's static sheen sits: the upper left, where the room's lamplight comes from (UI
 *  standards section 2, "Light"). Percent of the card. */
export const HOLO_STATIC_SHEEN = { px: 34, py: 26 } as const;

/** The idle animation (holo integrated, 2026-11-20): with the board's toggle on and no pointer, the card's tilt
 *  target circles the centre on this ellipse, so the foil and glare move exactly as a gentle hand tilt would.
 *  Starting values for the owner to judge, not measured. */
export const HOLO_IDLE = {
  /** Seconds per loop: slow enough to read as a card turning in lamplight, not a spinner (the old glare drift was 9 s
   *  each way). */
  periodS: 11,
  /** Half-width and half-height of the ellipse, percent of the card from its centre. */
  spanX: 34,
  spanY: 26,
  /** How engaged the card is while idle, 0 to 1: 0.45 tips it about 4 degrees at the ellipse's edge (0.34 x 2 x tiltMax x 0.45), a sway. */
  active: 0.45,
} as const;

/** Generic motion on the opened card's painting (owner, 2026-11-21, ledger #565: "I wanted the art to feel alive not
 *  the card"; picked drift and motes, wants to see depth). None of it knows where anything is in a painting. Starting
 *  values for the owner to judge on his phone, not measured. */
export const HOLO_ALIVE = {
  /** Slow drift: one way in this long, then eases back (12 s per the owner's pick "about 12 s"). */
  driftMs: 12000,
  /** How much the painting grows over one drift: 3% (owner's pick). */
  driftScale: 0.03,
  /** Pan over one drift, a share of the painting's width and height: 1.2% is a few pixels on the big card. */
  driftPan: 0.012,
  /** Depth on tilt: the furthest the painting shifts against the frame, a share of the card's width (about 5 px on a
   *  340 px phone card). The offset is clamped here, so the overscan below always covers it. */
  depth: 0.015,
  /** Motes shift this many times the painting's depth offset, so they read as nearer than the painting. */
  moteDepth: 1.6,
  /** Spare overscan past the worst case, a share of the painting, so a rounding pixel never shows an edge. */
  margin: 0.004,
  /** Mood motes on the whole painting: how many (sparse), and one slow crossing. */
  motes: 7,
  moteMs: 9000,
  /** The motion fades in over this once the open flight has landed. */
  fadeInMs: 600,
  /** Golden-ratio step that scatters the motes, so no two sit in a line. */
  scatter: 0.618,
} as const;

export const HOLO_POP = {
  /** One flight to the centre with one full turn. 900 ms reads as a flourish; under 600 ms the spin blurs (owner brief, round 2). */
  flyMs: 900,
  /** The card first lifts off its spot: this share of the flight, rising `liftRem` and growing by `liftScale`. */
  liftAt: 0.14,
  liftRem: 1.5,
  liftScale: 1.08,
  /** The card overshoots to this scale before it settles at 1, so it lands rather than stops. */
  overshoot: 1.05,
  /** Where in the flight the turn completes and the overshoot peaks, 0 to 1. With the ease-in-out below, half way
   *  through the flight the card is about 225 degrees round, so its back faces the player mid-flight. */
  overshootAt: 0.8,
  /** easeInOutCubic: slow out of the spot, fast across, slow into the centre. Round 1's ease-out front-loaded the
   *  spin and the owner read it as abrupt. */
  easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
  /** Tap the popped card: a half turn to the other face. Owner brief, round 2. */
  flipMs: 500,
  /** The card in the room fading back in when the big one closes: closing should never hold the player up. */
  returnMs: 380,
  /** Reduced motion: pop-out and flip become a crossfade, inside ADR-016's 150 to 250 ms gentle range. */
  fadeMs: 200,
  /** A full turn and a half turn, in degrees. */
  turn: 360,
  halfTurn: 180,
} as const;

/** The resident on the card is alive (look round 3, owner 2026-11-19): it breathes, and greets once it lands. */
export const HOLO_LIFE = {
  /** One breath: squash and stretch from the feet. Owner brief: about 3 s, about 2%. */
  breathMs: 3000,
  breathScale: 0.02,
  /** The small bob riding on each breath, as a share of the resident's height. 1% is about 5 px popped out. */
  bob: 0.01,
  /** The welcome expression shows this long after the card lands. Owner brief: about 1.5 s. */
  greetMs: 1500,
  /** While the card is open, the welcome comes back after a random wait in this range, counted from the end of the
   *  last hop. Owner, round 5: "every 10 seconds or so"; random so it never feels like a metronome. */
  repeatMinMs: 8000,
  repeatMaxMs: 13000,
  /** The hop that carries the swap in and out: squash, stretch up, settle. */
  hopMs: 460,
  hopSquash: 0.92,
  hopStretch: 1.06,
  /** Where in the hop the squash bottoms out (the expression swaps here, hidden by the squash) and the stretch peaks. */
  hopSquashAt: 0.25,
  hopStretchAt: 0.55,
  /** How high the hop rises, as a share of the resident's height. */
  hopRise: 0.04,
  /** Reduced motion: the swap is a crossfade instead, inside ADR-016's 150 to 250 ms gentle range. */
  fadeMs: 200,
} as const;

export type ExpressionOffset = { readonly x: number; readonly y: number; readonly scale: number };

/** Lines each resident's expression art up with its idle art. Both are fitted by prepare_holo_card_art.py; what
 *  drift is left is corrected here, scaled from the feet. Percent of the art's width and height, found by
 *  onion-skinning each pair. Sprout (2026-11-19): the welcome body read narrower and a little left; the eyes cannot
 *  meet, because the two poses look in different directions. Chomper (2026-11-20): the grin's body sits about 2%
 *  right of the idle body at the same width, feet on the same line. */
export const HOLO_EXPRESSION_OFFSET: Readonly<Record<string, ExpressionOffset>> = {
  sprout: { x: 1, y: 0, scale: 1.06 },
  chomper: { x: -2, y: 0, scale: 1 },
};
/** No correction: a resident whose pair has not been onion-skinned yet. */
export const HOLO_NO_OFFSET: ExpressionOffset = { x: 0, y: 0, scale: 1 };

/** The body-shaped tap area on the popped card's resident (owner, round 6): a tap there greets instead of flipping.
 *  Percent of the art box. Starting values: it skips the top quarter (the stem and the space over the head) and a
 *  little each side, so a tap on the backdrop beside the resident still flips. `round` is the corner radius. */
export const HOLO_PAT = { top: 25, side: 12, bottom: 0, round: 45 } as const;

/** A touch that travels further than this, in CSS px, was a tilt drag, not a tap, so it does not open the card.
 *  10 px is the usual touch slop on phones (Android's ViewConfiguration touch slop is 8 dp). */
export const HOLO_TAP_SLOP = 10;
/** A spring step longer than this (a background tab coming back) is clamped, so the card does not jump. Seconds. */
export const HOLO_MAX_STEP = 0.05;
/** The spring counts as settled once every value is this close to its target and moving slower than this. */
export const HOLO_SETTLE = 0.01;
/** Look-test URL parameters, honoured in mock mode only (round 12): which resident's card, which element's palette,
 *  and which of the three element placements (owner, 2026-11-20: "show me where the element goes"). */
export const HOLO_PARAMS = { resident: 'holores', element: 'holoelement', place: 'holoplace', scene: 'holoscene', art: 'holoart' } as const;
