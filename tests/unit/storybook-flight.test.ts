import assert from 'node:assert/strict';
import { test } from 'node:test';
import { flightFrame, flyIn, type FlightFrame, type Rect } from '../../src/storybook/flight.ts';
import { STORYBOOK, STORYBOOK_FLIGHT as F } from '../../src/storybook/constants.ts';
import { coverCue } from '../../src/storybook/state.ts';

// Unit layer (#565 S6): the closed book's entrance is a pure function of elapsed time from the trigger's rect to the
// book's rest rect. Rules: the brief's "Do" list (owner, 2026-11-21) and STATE-MACHINES-STORYBOOK.md, G15.

/** A 40 px button in the bottom-left corner, and a 300x420 book at rest centred at (500, 400). */
const origin: Rect = { left: 20, top: 760, width: 40, height: 40 };
const target: Rect = { left: 350, top: 190, width: 300, height: 420 };
const fromCentre = { x: 40 - 500, y: 780 - 400 };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const pose = (f: FlightFrame) => ({ x: f.x, y: f.y, scale: f.scale, turn: f.turn });

test('at the start the book sits on the trigger, button sized, tilted and unseen, the room not yet dimmed', () => {
  const f = flightFrame(0, origin, target, false);
  assert.deepEqual([pose(f), f.opacity, f.dim, f.landed], [{ ...fromCentre, scale: 40 / 300, turn: F.startTurn }, 0, 0, false]);
});

test('halfway through the flight the book is between the trigger and the centre, growing, above the straight line', () => {
  const f = flightFrame(F.flyMs / 2, origin, target, false);
  const straightY = fromCentre.y * (fromCentre.x === 0 ? 1 : f.x / fromCentre.x);
  assert.deepEqual([f.x < 0 && f.x > fromCentre.x, f.y < straightY, f.scale > 40 / 300 && f.scale < F.overshoot, f.landed], [true, true, true, false]);
});

test('on reaching the centre the book is at its overshoot, then dips under rest during the settle', () => {
  const landing = flightFrame(F.flyMs, origin, target, false);
  const settle = flightFrame(F.flyMs + (F.totalMs - F.flyMs) / 2, origin, target, false);
  assert.deepEqual([near(landing.x, 0), near(landing.y, 0), near(landing.scale, F.overshoot), settle.scale < 1], [true, true, true, true]);
});

test('at the end of the entrance the book is at rest, upright, fully shown over the dimmed room, motes gone', () => {
  const f = flightFrame(F.totalMs, origin, target, false);
  assert.deepEqual([pose(f), f.opacity, f.dim, f.motes, f.landed], [{ x: 0, y: 0, scale: 1, turn: 0 }, 1, 1, [], true]);
});

test('the gold motes appear only after the book lands near the centre, every one drifting above it', () => {
  const before = flightFrame(F.totalMs * F.moteFrom - 1, origin, target, false);
  const during = flightFrame(F.totalMs * (F.moteFrom + 1) / 2, origin, target, false);
  assert.deepEqual([before.motes.length, during.motes.length, during.motes.every(m => m.y < 0 && m.opacity > 0)], [0, F.motes, true]);
});

test('the entrance lasts 1.2-1.6 s (owner, 2026-11-21: "so fast that I missed it") and the settle is at least a third of it', () => {
  assert.deepEqual([F.totalMs >= 1200 && F.totalMs <= 1600, (F.totalMs - F.flyMs) / F.totalMs >= 1 / 3], [true, true]);
});

test('reduced motion: a plain fade over the fade time, no flight, no turn, no motes', () => {
  const half = flightFrame(STORYBOOK.fadeMs / 2, origin, target, true);
  const done = flightFrame(STORYBOOK.fadeMs, origin, target, true);
  assert.deepEqual([pose(half), half.opacity, half.motes, half.landed, done.landed], [{ x: 0, y: 0, scale: 1, turn: 0 }, 0.5, [], false, true]);
});

/** A clock the test moves by hand: `frame` queues one callback, `step` advances time and runs it. */
function fakeClock() {
  let now = 0, queued: (() => void) | null = null;
  return { clock: { now: () => now, frame: (cb: () => void) => { queued = cb; } },
    step: (ms: number) => { now += ms; const cb = queued; queued = null; cb?.(); } };
}

test('jumping to rest during the flight paints the book at rest at once and ends the flight', async () => {
  const { clock, step } = fakeClock(), painted: FlightFrame[] = [];
  const flight = flyIn(f => painted.push(f), origin, target, false, clock);
  step(F.flyMs / 2);
  flight.toRest();
  step(F.flyMs / 2);
  await flight.done;
  assert.deepEqual([painted.length, pose(painted.at(-1)!), painted.at(-1)!.landed], [3, { x: 0, y: 0, scale: 1, turn: 0 }, true]);
});

test('with no trigger on screen (zero-size rect) the book lands at once, no frames waited', () => {
  const { clock } = fakeClock(), painted: FlightFrame[] = [];
  flyIn(f => painted.push(f), { left: 0, top: 0, width: 0, height: 0 }, target, false, clock);
  assert.deepEqual(painted.map(f => f.landed), [true]);
});

test('the open cue waits while the book is arriving, and starts once it shows as the closed book', () => {
  const opening = { kind: 'opening' } as const;
  assert.deepEqual([coverCue(opening, 'arriving', false), coverCue(opening, 'closed', false)], [null, 'peek']);
});
