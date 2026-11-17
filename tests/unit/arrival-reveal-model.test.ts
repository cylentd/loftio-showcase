import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attributesOf, clipLive, next, releasesAudio, releasesFlight, INITIAL,
  type RevealEvent, type RevealState,
} from '../../src/residents/arrival-reveal-model.ts';

// Unit layer: the arrival reveal's lifecycle as a table. Doc: docs/architecture/STATE-MACHINES-ARRIVAL.md.
// Expected states are written out from the doc's tables, never taken from `next`.

const cinema = (flight: boolean, handoff: 'off' | 'pending' | 'on', framed: boolean, audioHeld: boolean): RevealState =>
  ({ kind: 'cinema', flight, handoff, framed, audioHeld });

const STATES = {
  idle: { kind: 'idle' } as RevealState,
  fresh: cinema(false, 'off', false, false),
  flying: cinema(true, 'off', false, false),
  landed: cinema(true, 'off', true, false),
  held: cinema(false, 'off', false, true),
  pending: cinema(true, 'pending', false, true),
  playing: cinema(false, 'on', true, true),
  naming: { kind: 'naming', framed: false } as RevealState,
  namingFramed: { kind: 'naming', framed: true } as RevealState,
  disposed: { kind: 'disposed' } as RevealState,
};
type Name = keyof typeof STATES;
const NAMES = Object.keys(STATES) as Name[];

/** One row per event: the state each starting state moves to. A name is a state from STATES; 'same' is a refusal. */
const FRESH = cinema(false, 'off', false, false);
const AFTER_SHOW: Record<Name, RevealState | 'same'> = {
  idle: FRESH, fresh: FRESH, flying: FRESH, landed: FRESH, held: FRESH, pending: FRESH, playing: FRESH,
  naming: FRESH, namingFramed: FRESH, disposed: 'same',
};
const ROWS: { event: RevealEvent; to: Record<Name, RevealState | 'same'> }[] = [
  { event: { type: 'show' }, to: AFTER_SHOW },
  { event: { type: 'flew' }, to: {
    idle: 'same', fresh: cinema(true, 'off', false, false), flying: 'same', landed: 'same', held: cinema(true, 'off', false, true),
    pending: 'same', playing: 'same', naming: 'same', namingFramed: 'same', disposed: 'same' } },
  { event: { type: 'held' }, to: {
    idle: 'same', fresh: cinema(false, 'off', false, true), flying: cinema(true, 'off', false, true), landed: cinema(true, 'off', true, true),
    held: 'same', pending: 'same', playing: 'same', naming: 'same', namingFramed: 'same', disposed: 'same' } },
  { event: { type: 'phase', phase: 'loading' }, to: {
    idle: 'same', fresh: cinema(false, 'pending', false, false), flying: cinema(true, 'pending', false, false),
    landed: cinema(true, 'pending', true, false), held: cinema(false, 'pending', false, true), pending: 'same',
    playing: cinema(false, 'pending', true, true), naming: 'same', namingFramed: 'same', disposed: 'same' } },
  { event: { type: 'phase', phase: 'playing' }, to: {
    idle: 'same', fresh: cinema(false, 'on', false, false), flying: cinema(false, 'on', false, false),
    landed: cinema(false, 'on', true, false), held: cinema(false, 'on', false, true), pending: cinema(false, 'on', false, true),
    playing: 'same', naming: 'same', namingFramed: 'same', disposed: 'same' } },
  { event: { type: 'phase', phase: 'retry' }, to: {
    idle: 'same', fresh: cinema(false, 'on', false, false), flying: cinema(false, 'on', false, false),
    landed: cinema(false, 'on', true, false), held: cinema(false, 'on', false, true), pending: cinema(false, 'on', false, true),
    playing: 'same', naming: 'same', namingFramed: 'same', disposed: 'same' } },
  { event: { type: 'landed' }, to: {
    idle: 'same', fresh: 'same', flying: cinema(true, 'off', true, false), landed: 'same', held: 'same',
    pending: cinema(true, 'pending', true, true), playing: 'same', naming: 'same', namingFramed: 'same', disposed: 'same' } },
  { event: { type: 'opened' }, to: {
    idle: 'same', fresh: { kind: 'naming', framed: false }, flying: { kind: 'naming', framed: false }, landed: { kind: 'naming', framed: true },
    held: { kind: 'naming', framed: false }, pending: { kind: 'naming', framed: false }, playing: { kind: 'naming', framed: true },
    naming: 'same', namingFramed: 'same', disposed: 'same' } },
  { event: { type: 'close' }, to: {
    idle: 'same', fresh: STATES.idle, flying: STATES.idle, landed: STATES.idle, held: STATES.idle, pending: STATES.idle,
    playing: STATES.idle, naming: STATES.idle, namingFramed: STATES.idle, disposed: 'same' } },
  { event: { type: 'dispose' }, to: {
    idle: STATES.disposed, fresh: STATES.disposed, flying: STATES.disposed, landed: STATES.disposed, held: STATES.disposed,
    pending: STATES.disposed, playing: STATES.disposed, naming: STATES.disposed, namingFramed: STATES.disposed, disposed: 'same' } },
];

for (const row of ROWS) {
  for (const from of NAMES) {
    const label = `${row.event.type}${'phase' in row.event ? ':' + row.event.phase : ''} from ${from}`;
    test(label, () => {
      const start = STATES[from], expected = row.to[from];
      const result = next(start, row.event);
      assert.deepEqual(result, expected === 'same' ? start : expected);
      assert.equal(result === start, expected === 'same', 'only a refused event returns the same object');
    });
  }
}

test('the machine starts idle', () => {
  assert.deepEqual(INITIAL, { kind: 'idle' });
});

test('a refused event never mutates the state it was given', () => {
  const start = cinema(true, 'pending', false, true);
  const copy = structuredClone(start);
  next(start, { type: 'flew' });
  assert.deepEqual(start, copy);
});

const run = (events: RevealEvent[], from: RevealState = INITIAL) => {
  let state = from, releases = 0, flights = 0;
  for (const event of events) {
    const after = next(state, event);
    if (releasesAudio(state, after)) releases += 1;
    if (releasesFlight(state, after)) flights += 1;
    state = after;
  }
  return { state, releases, flights };
};

test('audio is released exactly once when the box opens and the dialog then closes', () => {
  const result = run([{ type: 'show' }, { type: 'held' }, { type: 'opened' }, { type: 'close' }, { type: 'close' }]);
  assert.equal(result.releases, 1);
  assert.deepEqual(result.state, { kind: 'idle' });
});

test('audio is released exactly once when the dialog closes before the box opens', () => {
  assert.equal(run([{ type: 'show' }, { type: 'held' }, { type: 'close' }, { type: 'opened' }, { type: 'close' }]).releases, 1);
});

test('showing again releases the previous hold once, and its own hold once more', () => {
  const result = run([{ type: 'show' }, { type: 'held' }, { type: 'show' }, { type: 'held' }, { type: 'close' }]);
  assert.equal(result.releases, 2);
});

test('dispose after a held show releases audio once, and a later close releases nothing', () => {
  const result = run([{ type: 'show' }, { type: 'held' }, { type: 'dispose' }, { type: 'close' }, { type: 'opened' }]);
  assert.equal(result.releases, 1);
  assert.deepEqual(result.state, { kind: 'disposed' });
});

const STAYS_IN_CINEMA: RevealEvent[] = [
  { type: 'show' }, { type: 'flew' }, { type: 'held' }, { type: 'phase', phase: 'loading' }, { type: 'landed' },
  { type: 'phase', phase: 'playing' }, { type: 'phase', phase: 'retry' }, { type: 'phase', phase: 'loading' },
];

test('a hold is kept through loading, landing, playing and retry, and released once at the close', () => {
  assert.equal(run(STAYS_IN_CINEMA).releases, 0);
  assert.equal(run([...STAYS_IN_CINEMA, { type: 'close' }, { type: 'close' }]).releases, 1);
});

for (const [index, step] of STAYS_IN_CINEMA.slice(3).entries()) {
  const eventName = step.type === 'phase' ? `phase:${step.phase}` : step.type;
  test(`${eventName} (cinema sequence step ${index + 1}) while held stays in cinema and does not release the audio`, () => {
    const held = cinema(true, 'off', false, true);
    const after = next(held, step);
    assert.equal(after.kind, 'cinema');
    assert.equal(releasesAudio(held, after), false);
  });
}

test('a reveal that never held audio releases none', () => {
  assert.equal(run([{ type: 'show' }, { type: 'opened' }, { type: 'close' }]).releases, 0);
});

test('a flight that lands after the dialog closed changes nothing and is not released again', () => {
  const result = run([{ type: 'show' }, { type: 'flew' }, { type: 'close' }, { type: 'landed' }]);
  assert.deepEqual(result.state, { kind: 'idle' });
  assert.equal(result.flights, 1);
});

test('a flight that lands after the video took over (playing) is refused', () => {
  const result = run([{ type: 'show' }, { type: 'flew' }, { type: 'phase', phase: 'playing' }, { type: 'landed' }]);
  assert.deepEqual(result.state, cinema(false, 'on', false, false));
  assert.equal(result.flights, 1);
});

const FLIGHT_ENDS: RevealEvent[] = [
  { type: 'close' }, { type: 'dispose' }, { type: 'opened' }, { type: 'show' }, { type: 'phase', phase: 'retry' },
];
for (const end of FLIGHT_ENDS) {
  test(`a flight is released once when it ends by ${end.type}, even if the event repeats`, () => {
    assert.equal(run([{ type: 'show' }, { type: 'flew' }, end, end]).flights, 1);
  });
}

test('retry then loading again re-enters the handoff wait without a flight', () => {
  const result = run([{ type: 'show' }, { type: 'phase', phase: 'loading' }, { type: 'phase', phase: 'retry' }, { type: 'phase', phase: 'loading' }]);
  assert.deepEqual(result.state, cinema(false, 'pending', false, false));
});

const AFTER_OPENED: RevealEvent[] = [{ type: 'opened' }, { type: 'flew' }, { type: 'held' }, { type: 'landed' }, { type: 'phase', phase: 'loading' }];
for (const event of AFTER_OPENED) {
  test(`${event.type} after the box opened changes nothing`, () => {
    const opened = run([{ type: 'show' }, { type: 'opened' }]).state;
    assert.strictEqual(next(opened, event), opened);
  });
}

const ATTRIBUTES: [Name, { cinema: string | null; handoff: string | null; framed: string | null }][] = [
  ['idle', { cinema: null, handoff: null, framed: null }],
  ['fresh', { cinema: 'true', handoff: 'false', framed: null }],
  ['landed', { cinema: 'true', handoff: 'false', framed: 'true' }],
  ['pending', { cinema: 'true', handoff: 'pending', framed: null }],
  ['playing', { cinema: 'true', handoff: 'true', framed: 'true' }],
  ['naming', { cinema: 'false', handoff: null, framed: null }],
  ['namingFramed', { cinema: 'false', handoff: null, framed: 'true' }],
  ['disposed', { cinema: null, handoff: null, framed: null }],
];
for (const [name, expected] of ATTRIBUTES) {
  test(`dialog attributes while ${name}`, () => assert.deepEqual(attributesOf(STATES[name]), expected));
}

const LIVE: [Name, boolean][] = [
  ['idle', false], ['fresh', true], ['pending', true], ['playing', true], ['naming', false], ['disposed', false],
];
for (const [name, expected] of LIVE) {
  test(`clip audio may be muted while ${name}: ${expected}`, () => assert.equal(clipLive(STATES[name]), expected));
}
