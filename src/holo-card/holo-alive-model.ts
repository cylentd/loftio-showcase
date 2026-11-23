// Generic motion on the opened card's painting (look test #565): slow drift, mood motes, depth on tilt. Pure, so the
// unit test runs without a browser; holo-alive.ts builds the DOM from it.

export const ALIVE_PARTS = ['drift', 'motes', 'depth'] as const;
export type AlivePart = (typeof ALIVE_PARTS)[number];
export type AliveState = Readonly<Record<AlivePart, boolean>>;

export const MOTE_KINDS = ['dust', 'firefly', 'ember'] as const;
export type MoteKind = (typeof MOTE_KINDS)[number];

const PERCENT = 100;
const HALF = 0.5;
const CENTRE = 50;
const MS_PER_SECOND = 1000;
/** Pan direction for one drift: right and a little up, so the painting seems to breathe toward its sky. */
const PAN_UP = -0.6;

/** All three on (the owner's default), or all off under reduced motion. */
export const aliveInitial = (reduced: boolean): AliveState => ({ drift: !reduced, motes: !reduced, depth: !reduced });

/** The card's mood tag picks the motes; an unknown tag gets dust. */
export const moteKind = (mood: string): MoteKind => ((MOTE_KINDS as readonly string[]).includes(mood) ? mood as MoteKind : 'dust');

/** Where each mote starts (percent of the painting) and its negative delay, so it is already mid-flight when the motes
 *  fade in. `seed` is the card's index, so neighbouring cards scatter differently and a card repeats itself. */
export function motePlan(seed: number, t: { motes: number; scatter: number; moteMs: number }): { x: number; y: number; delayS: number }[] {
  const frac = (n: number) => n - Math.floor(n);
  const { motes: count, scatter, moteMs } = t;
  return Array.from({ length: count }, (_, i) => {
    const t = frac((seed + 1) * scatter + i * scatter);
    const u = frac((seed + i + 1) * scatter * scatter + i / count);
    return { x: Math.round(t * PERCENT), y: Math.round(u * PERCENT), delayS: -Math.round(frac(t + u) * moteMs) / MS_PER_SECOND };
  });
}

/** One drift's two ends: rest, then grown by `driftScale` and panned by `driftPan` (shares of the painting). */
export function driftFrames(t: { driftScale: number; driftPan: number }) {
  return { from: { x: 0, y: 0, scale: 1 }, to: { x: t.driftPan, y: t.driftPan * PAN_UP, scale: 1 + t.driftScale } };
}

/** The painting's shift for a tilt (px, py in percent of the card, active 0 to 1): against the tilt, as if set deeper,
 *  clamped at `depth` (a share of the card's width) whatever the pointer does. */
export function depthOffset(px: number, py: number, active: number, depth: number): { x: number; y: number } {
  const clamp = (v: number) => Math.max(-depth, Math.min(depth, v));
  const along = (p: number) => clamp(((CENTRE - p) / CENTRE) * depth * active) + 0; // + 0 turns -0 into 0
  return { x: along(px), y: along(py) };
}

/** The base scale that keeps the painting past every edge: half the overhang must cover the pan (scaled with the
 *  painting, since the pan sits inside the scale) plus the clamped depth offset plus a margin. */
export const overscanScale = (pan: number, depth: number, margin: number): number => (HALF + depth + margin) / (HALF - pan);

/** True when a painting at base `scale`, panned by `pan` and shifted by `offset`, still covers the frame. */
export const coversFrame = (scale: number, pan: number, offset: number): boolean => (scale - 1) * HALF - scale * pan - offset >= 0;
