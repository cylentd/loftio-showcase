// Pure maths for the holographic card: pointer position to the CSS custom properties the foil reads, and the
// spring that smooths them. No DOM, so the unit test runs without a browser.
import { HOLO_LIFE, HOLO_PARAMS } from './constants';

import { ELEMENTS, type HoloElement } from './holo-element-glyph-data';

// The element list lives in the data file (a data file may not import a model); re-exported here for callers.
export { ELEMENTS, type HoloElement };

/**
 * LOOK-TEST STAND-IN. The resident loadout carries no element yet (Loft Rumble will add it); until it does, the card
 * reads the originals' elements from this map (owner, 2026-11-20). Delete it when the loadout has the field.
 */
export const MOCK_ELEMENTS: Readonly<Record<string, HoloElement>> = {
  sprout: 'bloom', slime: 'splash', burger: 'ember', hoodie: 'spark', puff: 'spark', chomper: 'chaos',
};

/** The residents whose card has art (two images each, prepare_holo_card_art.py). The first is the default. */
export const CARD_RESIDENTS = ['sprout', 'slime', 'burger', 'hoodie', 'puff', 'chomper'] as const;
/** An original with card art. The card itself draws a `CardSubject` (holo-card-subject.ts), not this id. */
export type OriginalId = (typeof CARD_RESIDENTS)[number];

/** The three element placements the owner compares (round 12): a name-row medallion, a gem in the top border, the
 *  backdrop plus a word on the bottom border. The first is the default. */
export const PLACES = ['a', 'b', 'c'] as const;
export type Place = (typeof PLACES)[number];

const FALLBACK_ELEMENT: HoloElement = 'bloom';

/** One mock-mode URL parameter, or null outside mock mode: the look test never changes a real visit's card. */
function mockParam(search: string, name: string): string | null {
  const params = new URLSearchParams(search);
  return params.get('mode') === 'mock' ? params.get(name) : null;
}
const oneOf = <T extends string>(list: readonly T[], value: string | null | undefined): value is T =>
  list.includes(value as T);

/** Which look test the URL asks for: `?holocard` (and `&holocompare` for the board), honoured only in mock mode like
 *  `?arrival`, so no real visit reaches it. Null means do nothing. */
export function holoLook(search: string): 'card' | 'compare' | null {
  const params = new URLSearchParams(search);
  if (params.get('mode') !== 'mock' || !params.has('holocard')) return null;
  return params.has('holocompare') ? 'compare' : 'card';
}

/** Whose card shows: `?holores=` in mock mode when it names a resident with card art, else the first. */
export function cardResident(search: string): OriginalId {
  const override = mockParam(search, HOLO_PARAMS.resident);
  return oneOf(CARD_RESIDENTS, override) ? override : CARD_RESIDENTS[0];
}

/** The element whose palette the card wears, as its `data-element`: `?holoelement=` in mock mode, else the resident's
 *  element (from the stand-in map), else bloom. Replaces round 10's palette by trait. */
export function cardElement(residentId: string, search: string): HoloElement {
  const override = mockParam(search, HOLO_PARAMS.element);
  if (oneOf(ELEMENTS, override)) return override;
  const own = MOCK_ELEMENTS[residentId];
  return own ?? FALLBACK_ELEMENT;
}

/** Where the element sits on the card: `?holoplace=` in mock mode, else placement a. */
export function cardPlace(search: string): Place {
  const override = mockParam(search, HOLO_PARAMS.place);
  return oneOf(PLACES, override) ? override : PLACES[0];
}

/** LOOK TEST (2026-11-20): the scenes made by the builder's local pipeline (game/scripts/holo-scenes/). A real
 *  resident's scene will come with its record; until then the ids here are the residents that have one. */
export const SCENES = ['puff', 'chomper', 'cloud'] as const;
export type Scene = (typeof SCENES)[number];
const NO_SCENE = 'none';

/** The card's painted scene: `?holoscene=` in mock mode (`none` for the drawn burst), else the resident's own, else
 *  null, which keeps the drawn burst. */
export function cardScene(residentId: string, search: string): Scene | null {
  const override = mockParam(search, HOLO_PARAMS.scene);
  if (override === NO_SCENE) return null;
  if (oneOf(SCENES, override)) return override;
  return oneOf(SCENES, residentId) ? residentId : null;
}

/** LOOK TEST (2026-11-20): each resident's alt art paintings, a moment from its life in a new pose, not the idle
 *  (owner: "not the same idle pose"). Image files: holo-card-scenes.ts. */
export const ALT_ARTS: Readonly<Record<string, readonly string[]>> = {
  sprout: ['a', 'b'], slime: ['a', 'b'], burger: ['a', 'b'], hoodie: ['a', 'b'], puff: ['a', 'b'], chomper: ['a', 'b'],
};

/** Which alt art the card shows: `?holoart=<variant>` in mock mode when the resident has it, else null (standard). */
export function cardArt(residentId: string, search: string): string | null {
  const variant = mockParam(search, HOLO_PARAMS.art);
  return variant !== null && (ALT_ARTS[residentId] ?? []).includes(variant) ? variant : null;
}

export type RepeatBounds = { repeatMinMs: number; repeatMaxMs: number };

/** Milliseconds until the resident greets again: uniform in [min, max), so the repeat never ticks like a metronome.
 *  `rng` returns [0, 1), like Math.random, and is injected so a test can place the draw. */
export function nextGreetDelay(rng: () => number, bounds: RepeatBounds = HOLO_LIFE): number {
  return bounds.repeatMinMs + (bounds.repeatMaxMs - bounds.repeatMinMs) * rng();
}

export type Rect = { left: number; top: number; width: number; height: number };
export type HoloTune = { tiltMax: number; shineTravel: number };

/** The CSS custom properties one card frame writes. Percentages are 0 to 100, angles in degrees. */
export type HoloVars = {
  /** Pointer across and down the card, percent: where the glare is centred. */
  px: number; py: number;
  /** Tilt about the horizontal and vertical axes, degrees. Positive `rx` tips the top edge away. */
  rx: number; ry: number;
  /** Foil pattern position, percent: it slides opposite the pointer, like light moving over a tipped card. */
  bx: number; by: number;
  /** Distance of the pointer from the centre, 0 at the centre to 1 at a corner, times how engaged the card is. */
  from: number;
};

const CENTRE = 50;
const FULL = 100;
const HALF = 0.5;
/** Centre-to-corner distance of a unit square, so a corner reads as 1. */
const CORNER = Math.SQRT1_2;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** A client-space pointer as a percent of the card's box, clamped to the card. A zero-sized box reads as the centre. */
export function pointerPercent(x: number, y: number, rect: Rect): { px: number; py: number } {
  const across = rect.width > 0 ? (x - rect.left) / rect.width : HALF;
  const down = rect.height > 0 ? (y - rect.top) / rect.height : HALF;
  return { px: clamp(across, 0, 1) * FULL, py: clamp(down, 0, 1) * FULL };
}

/**
 * The variables for a pointer at (px, py) percent. `active` runs 0 (at rest) to 1 (held or hovered), so a card the
 * pointer leaves eases back flat through the same spring rather than snapping.
 */
export function holoVars(px: number, py: number, active: number, tune: HoloTune): HoloVars {
  const cx = clamp(px, 0, FULL) / FULL - HALF;
  const cy = clamp(py, 0, FULL) / FULL - HALF;
  const engaged = clamp(active, 0, 1);
  const tilt = 2 * tune.tiltMax * engaged;
  return {
    px: (cx + HALF) * FULL, py: (cy + HALF) * FULL,
    rx: -cy * tilt, ry: cx * tilt,
    bx: CENTRE - cx * tune.shineTravel * engaged, by: CENTRE - cy * tune.shineTravel * engaged,
    from: clamp(Math.hypot(cx, cy) / CORNER, 0, 1) * engaged,
  };
}

/** The pointer at (x, y) in client space over `rect`, fully engaged: what a card shows once the spring settles. */
export function pointerVars(x: number, y: number, rect: Rect, tune: HoloTune): HoloVars {
  const { px, py } = pointerPercent(x, y, rect);
  return holoVars(px, py, 1, tune);
}

/**
 * The foil offset the gradients move by (holo integrated, 2026-11-20): the pattern position `bx, by` as a signed share
 * of its travel, -1 to 1, 0 at rest. Positive `mx` is the pointer right of centre. Each foil layer multiplies it by
 * its own rate and angle in CSS, so the layers shift against each other as the card tips.
 */
export function foilOffset(vars: HoloVars, tune: HoloTune): { mx: number; my: number } {
  const half = tune.shineTravel / 2;
  if (half === 0) return { mx: 0, my: 0 };
  return { mx: (CENTRE - vars.bx) / half + 0, my: (CENTRE - vars.by) / half + 0 }; // + 0 turns -0 into 0
}

export type IdleTune = { periodS: number; spanX: number; spanY: number; active: number };

/**
 * Where the idle animation points the card at `t` seconds: one slow ellipse round the centre, starting at its right,
 * passing the bottom a quarter period on. It feeds the same spring targets as the pointer, so the idle motion is the
 * tilt motion and a release eases back onto it.
 */
export function idlePoint(t: number, tune: IdleTune): { px: number; py: number; active: number } {
  const angle = (2 * Math.PI * t) / tune.periodS;
  return { px: CENTRE + tune.spanX * Math.cos(angle), py: CENTRE + tune.spanY * Math.sin(angle), active: tune.active };
}

export type FlightTune ={ liftAt: number; liftScale: number; overshoot: number; overshootAt: number; turn: number };

/**
 * The pop-out flight as transform keyframes: from the card's spot (offset dx, dy and `scale` relative to the centre),
 * a lift, then one turn while it travels, an overshoot, and rest. The turn runs at one rate through every keyframe,
 * so the spin never stalls or jumps between segments. `liftPx` is how far it rises at the lift.
 */
export function flightKeyframes(dx: number, dy: number, scale: number, liftPx: number, tune: FlightTune): Keyframe[] {
  const turnAt = (offset: number) => tune.turn * Math.min(1, offset / tune.overshootAt);
  const frame = (offset: number, x: number, y: number, size: number) =>
    ({ offset, transform: `translate(${x}px, ${y}px) scale(${size}) rotateY(${turnAt(offset)}deg)` });
  const travelled = 1 - tune.liftAt / tune.overshootAt; // share of the journey still to go after the lift
  return [
    frame(0, dx, dy, scale),
    frame(tune.liftAt, dx * travelled, dy * travelled - liftPx, scale * tune.liftScale),
    frame(tune.overshootAt, 0, 0, tune.overshoot),
    frame(1, 0, 0, 1),
  ];
}

export type Spring = { value: number; velocity: number };

/** One semi-implicit Euler step of a damped spring toward `target`. `dt` in seconds. */
export function springStep(spring: Spring, target: number, stiffness: number, damping: number, dt: number): Spring {
  const velocity = spring.velocity + (stiffness * (target - spring.value) - damping * spring.velocity) * dt;
  return { value: spring.value + velocity * dt, velocity };
}
