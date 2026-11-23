// The storybook page (#565): every timing, width break and asset name in one place. Sizes live in storybook.css.

export const STORYBOOK = {
  /** Pages in view: one on a phone, a two-page spread on a desktop. The binder's break, so both read the same. */
  phoneQuery: '(max-width: 640px)',
  perViewPhone: 1,
  perViewDesktop: 2,
  /** Card slots on one page: a 3x3 grid (owner, 2026-11-21: "smaller cards. im thinking 3x3"). */
  slotsPerPage: 9,
  /** Cards in one row of a page, so today's three cards per original make one row per resident. */
  perRow: 3,
  /** The cover swinging open, ms: slower than a page turn (720 ms, binder constants) because the cover is heavy board. */
  openMs: 1100,
  /** A page turn, ms. Same as the binder's turn (BINDER.turnMs), so the two books feel like one material. */
  turnMs: 720,
  phoneTurnMs: 120,
  /** Reduced motion: every flip becomes this crossfade, ms (BINDER.fadeMs). */
  fadeMs: 260,
  /** Paper easing: slow off the spine, settles flat. The binder's curve. */
  easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)',
  /** A half turn of the cover or a leaf, degrees. */
  halfTurn: 180,
  /** Share of a turn after which the page the leaf covers is gone (it is under the leaf by then). */
  coverAt: 0.5,
  /** Share of a turn where the leaf starts to fade, so its plain paper back never pops off the new page. */
  leafFadeAt: 0.82,
} as const;

/** S6, the book flying into view (owner, 2026-11-21: "it flies into view and settles with some magic"). The closed book
 *  lifts off its origin (the Collection button), flies to the centre growing and turning, settles with a soft bounce
 *  and sheds a few gold motes. Shares are of the whole entrance; lengths are of the book at rest. */
export const STORYBOOK_FLIGHT = {
  /** The whole entrance, ms. Was 700 (the S6 brief's cap); owner feedback 2026-11-21, "the animation is so fast that I
   *  missed it", asked for slower: 1400 sits mid-range of the 1.2-1.6 s the round allowed. A tap still lands it at once. */
  totalMs: 1400,
  /** The flight to the centre, ms; the settle bounce takes the rest (500 ms), long enough to read as a settle. */
  flyMs: 900,
  /** The turn the book starts with, degrees: a tilt that straightens as it lands. */
  startTurn: -16,
  /** How far the book arcs up off the straight line, as a share of its height: it lifts over the centre before it
   *  drops into place (0.12 at 700 ms read as a slide, owner 2026-11-21). */
  arc: 0.22,
  /** The scale it reaches on landing before settling to 1: the overshoot of the bounce. */
  overshoot: 1.05,
  /** The settle's bounce count, in half waves: 1.5 dips once under rest and comes back. */
  settleWaves: 1.5,
  /** The flight's ease-out power: 2.5 leaves the button less abruptly than cubic, so the lift is seen, and still slows
   *  into the centre. */
  easePower: 2.5,
  /** Share of the flight over which the book fades in from the small button. */
  fadeIn: 0.25,
  /** The gold motes: how many, when they start (share of the whole), their fan (radians, centred straight up; 1.6 keeps the outer ones on screen over a full-width phone book) and how
   *  far they drift (share of the book's width). */
  motes: 5, moteFrom: 0.55, moteFan: 1.6, moteDrift: 0.22,
  /** Where a mote starts: on an ellipse this share of the book's half size, so it leaves from the book's edge. */
  moteEdge: 0.9,
} as const;

/** The painted art a look URL may point at (`art=<base>`, mock only). Not in the repo until the owner picks. */
export const STORYBOOK_ART = {
  cover: 'cover-a', endpaper: 'endpaper-a', paper: 'paper-a',
  /** S4 margin sketches (docs/design/storybook-sketches/prompts.json): corners, the band over the cards, the tailpiece
   *  under them, and the vignettes behind the grid (S5) and in an empty card slot. */
  cornerTl: 'sketch-corner-a', cornerBr: 'sketch-corner-b', head: 'sketch-header', tail: 'sketch-tailpiece',
  vignette: 'sketch-vignette-a', vignetteAlt: 'sketch-vignette-b',
} as const;
export type ArtPart = keyof typeof STORYBOOK_ART;
export const SKETCH_PARTS: readonly ArtPart[] = ['cornerTl', 'cornerBr', 'head', 'tail', 'vignette', 'vignetteAlt'];
/** S5: the web-size copy first (raw pipeline PNGs ran 1.6-2.5 MB, owner 2026-11-21: "the art loads slow"), the PNG
 *  when a base has no .webp. */
export const ART_FORMATS = ['webp', 'png'] as const;
/** Load order: the cover with the paper and endpaper the swing reveals, all three at once (owner 2026-11-21: "images
 *  are not loading until a while later"; queued one after another they waited on each other), then the sketches. */
export const ART_PHASES: readonly (readonly ArtPart[])[] = [['cover', 'paper', 'endpaper'], SKETCH_PARTS];

/** When the cover is fetched (owner 2026-11-21: "images are not loading until a while later. like the storybook cover"). */
export const STORYBOOK_LOAD = {
  /** The cover preload starts at the first idle moment after the room is built, and at the latest this long after,
   *  ms. Built means before the intro ends, so the book (which opens on load in the look URL) finds the cover
   *  decoded. The cover is 252 KB (.webp, run 20261121T214244Z); a visitor without the look flag fetches nothing. */
  preloadIdleMs: 1500,
  /** How long a tap waits for an undecoded cover before the book flies with the code-drawn one, ms. Under the 0.5 s a
   *  tap can lag before it reads as ignored; past it the painted cover crossfades in after landing. */
  coverWaitMs: 400,
} as const;
export const SHELF = {
  desktop: { x: 840, y: 682, width: 53 },
  portrait: { x: 548, y: 550, width: 47 },
  cueKey: 'loftio.storybook.shelf-seen',
  look: 'shelf',
} as const;
