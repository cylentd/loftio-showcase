// S6, the closed book flying into view (#565). `flightFrame` is a pure function of elapsed time: where the book is,
// how big, how turned, how seen, how dim the room is and where the gold motes are, from the origin rect (the
// Collection button today, a shelf object later: LFT-089) to the book's rest rect. `flyIn` drives it on an injected
// clock, so tests never wait on a real one. Reduced motion: a plain fade, no flight, no motes.
import { STORYBOOK, STORYBOOK_FLIGHT as F } from './constants';

export type Rect = { left: number; top: number; width: number; height: number };
/** Offsets are px from the book's rest centre; `turn` is degrees; `motes` sit relative to the same centre. */
export type FlightFrame = {
  x: number; y: number; scale: number; turn: number; opacity: number; dim: number;
  motes: { x: number; y: number; opacity: number }[]; landed: boolean;
};
export type FlightClock = { now: () => number; frame: (cb: () => void) => void };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (p: number) => 1 - (1 - p) ** F.easePower;
const centre = (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
const AT_REST: FlightFrame = { x: 0, y: 0, scale: 1, turn: 0, opacity: 1, dim: 1, motes: [], landed: true };

function motes(t: number, target: Rect): FlightFrame['motes'] {
  const from = F.totalMs * F.moteFrom, m = clamp01((t - from) / (F.totalMs - from));
  if (t < from) return [];
  return Array.from({ length: F.motes }, (_, i) => {
    const angle = -Math.PI / 2 + F.moteFan * (i / (F.motes - 1) - 1 / 2), drift = F.moteDrift * target.width * easeOut(m);
    return {
      x: Math.cos(angle) * (target.width / 2 * F.moteEdge + drift),
      y: Math.sin(angle) * (target.height / 2 * F.moteEdge + drift),
      opacity: Math.sin(Math.PI * m),
    };
  });
}

export function flightFrame(t: number, origin: Rect, target: Rect, reduced: boolean): FlightFrame {
  if (reduced) {
    const p = clamp01(t / STORYBOOK.fadeMs);
    return p >= 1 ? AT_REST : { ...AT_REST, opacity: p, dim: p, landed: false };
  }
  if (t >= F.totalMs) return AT_REST;
  const from = centre(origin), to = centre(target), start = origin.width / target.width;
  const p = clamp01(t / F.flyMs), e = easeOut(p), q = clamp01((t - F.flyMs) / (F.totalMs - F.flyMs));
  const scale = p < 1 ? start + (F.overshoot - start) * e : 1 + (F.overshoot - 1) * (1 - q) * Math.cos(F.settleWaves * Math.PI * q);
  return {
    x: (from.x - to.x) * (1 - e),
    y: (from.y - to.y) * (1 - e) - F.arc * target.height * Math.sin(Math.PI * e),
    scale, turn: F.startTurn * (1 - e), opacity: clamp01(p / F.fadeIn), dim: e,
    motes: motes(t, target), landed: false,
  };
}

const sized = (r: Rect | null): r is Rect => !!r && r.width > 0 && r.height > 0;

/** Plays the entrance through `paint`, one frame per clock tick. With no clock, or no rect to fly from (the trigger
 *  off screen) or to, it paints the book at rest at once. `toRest` paints the rest pose now; `stop` just ends it. */
export function flyIn(paint: (f: FlightFrame) => void, origin: Rect | null, target: Rect | null, reduced: boolean, clock: FlightClock | null) {
  let finish = () => {}, live = true;
  const done = new Promise<void>(resolve => { finish = resolve; });
  const end = (rest: boolean) => { if (!live) return; live = false; if (rest) paint(AT_REST); finish(); };
  const canFly = clock && sized(target) && (reduced || sized(origin));
  if (!canFly) { end(true); return { toRest: () => {}, stop: () => {}, done }; }
  const begun = clock.now();
  const tick = () => {
    if (!live) return;
    const f = flightFrame(clock.now() - begun, origin ?? target, target, reduced);
    if (f.landed) { end(true); return; }
    paint(f);
    clock.frame(tick);
  };
  tick();
  return { toRest: () => end(true), stop: () => end(false), done };
}
