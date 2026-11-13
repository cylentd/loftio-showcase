import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL, next } from '../../src/resident-lifecycle.ts';
import type { Holder, Lifecycle, LifeEvent, Motion, Pt } from '../../src/resident-lifecycle.ts';

const O: Pt = { x: 10, y: 20 };
const P: Pt = { x: 3, y: 4 };

// Plain constructors for literal states. They hold no transition rule. A held resident has no motion of its own:
// it only stashes the motion to resume. Held columns differ in resume and holder; pickUp rows name the parcel and
// handOver rows name play, so a kept value and a new one cannot be confused.
const F = (motion: Motion): Lifecycle => ({ kind: 'free', motion });
const H = (resume: Motion, origin: Pt, holder: Holder): Lifecycle => ({ kind: 'held', holder, resume, origin });

type Col = { name: string; make: () => Lifecycle };

const COLS: readonly Col[] = [
  { name: 'F(still)', make: () => Object.freeze(F('still')) },
  { name: 'F(walking)', make: () => Object.freeze(F('walking')) },
  { name: 'F(paused)', make: () => Object.freeze(F('paused')) },
  { name: 'H(walking,hand)', make: () => Object.freeze(H('walking', Object.freeze({ ...O }), 'hand')) },
  { name: 'H(paused,play)', make: () => Object.freeze(H('paused', Object.freeze({ ...O }), 'play')) },
  { name: 'H(still,hand)', make: () => Object.freeze(H('still', Object.freeze({ ...O }), 'hand')) },
];

// null means refused: the very same object comes back.
type Expect = Lifecycle | null;
type EventRow = { label: string; event: () => LifeEvent; out: readonly Expect[] };

const EVENTS: readonly EventRow[] = [
  { label: 'pickUp by:parcel', event: () => ({ type: 'pickUp', at: { ...P }, by: 'parcel' }), out: [
    H('still', P, 'parcel'), H('walking', P, 'parcel'), H('paused', P, 'parcel'),
    H('walking', O, 'parcel'), H('paused', O, 'parcel'), H('still', O, 'parcel'),
  ] },
  { label: 'handOver to:play', event: () => ({ type: 'handOver', to: 'play' }), out: [
    null, null, null, H('walking', O, 'play'), null, H('still', O, 'play'),
  ] },
  { label: 'putDown placed:true', event: () => ({ type: 'putDown', placed: true }), out: [
    null, null, null, F('still'), F('still'), F('still'),
  ] },
  { label: 'putDown placed:false', event: () => ({ type: 'putDown', placed: false }), out: [
    null, null, null, F('walking'), F('paused'), F('still'),
  ] },
  { label: 'walk', event: () => ({ type: 'walk' }), out: [
    F('walking'), null, F('walking'), null, null, null,
  ] },
  { label: 'arrive', event: () => ({ type: 'arrive' }), out: [
    null, F('still'), null, null, null, null,
  ] },
  { label: 'stop', event: () => ({ type: 'stop' }), out: [
    null, F('paused'), F('still'), null, null, null,
  ] },
  { label: 'resume', event: () => ({ type: 'resume' }), out: [
    null, null, F('walking'), null, null, null,
  ] },
  { label: 'reset', event: () => ({ type: 'reset' }), out: [
    null, F('still'), F('still'), F('still'), F('still'), F('still'),
  ] },
  { label: 'halt', event: () => ({ type: 'halt' }), out: [
    null, F('still'), null, null, null, null,
  ] },
];

const frozenEvent = (row: EventRow): LifeEvent => {
  const event = row.event();
  if (event.type === 'pickUp') Object.freeze(event.at);
  return Object.freeze(event);
};

const ROWS = EVENTS.flatMap((row) =>
  COLS.map((col, i) => ({ name: `${row.label}: ${col.name}`, col, row, want: row.out[i] as Expect })),
);

test('every event row has one expected cell per from-state', () => {
  assert.deepStrictEqual(EVENTS.map((row) => row.out.length), EVENTS.map(() => COLS.length));
});

test('INITIAL is free and still', () => {
  assert.deepStrictEqual(INITIAL, { kind: 'free', motion: 'still' });
});

for (const { name, col, row, want } of ROWS.filter((r) => r.want !== null)) {
  test(`${name} -> ${JSON.stringify(want)}`, () => {
    const from = col.make();
    assert.deepStrictEqual(next(from, frozenEvent(row)), want);
  });
}

for (const { name, col, row } of ROWS.filter((r) => r.want === null)) {
  test(`${name} is refused with the same object`, () => {
    const from = col.make();
    assert.strictEqual(next(from, frozenEvent(row)), from);
  });
}

for (const holder of ['hand', 'play', 'parcel'] as const) {
  test(`handOver to the holder it already has (${holder}) is refused with the same object`, () => {
    const from = Object.freeze(H('walking', Object.freeze({ ...O }), holder));
    assert.strictEqual(next(from, Object.freeze({ type: 'handOver', to: holder })), from);
  });

  test(`pickUp by the holder it already has (${holder}) is refused with the same object`, () => {
    const from = Object.freeze(H('walking', Object.freeze({ ...O }), holder));
    assert.strictEqual(next(from, Object.freeze({ type: 'pickUp', at: Object.freeze({ ...P }), by: holder })), from);
  });
}

test('pickUp copies the point: origin equals it but is not the event object', () => {
  const at: Pt = { x: 3, y: 4 };
  const got = next(F('walking'), { type: 'pickUp', at, by: 'hand' }) as Extract<Lifecycle, { kind: 'held' }>;
  assert.deepStrictEqual(got, H('walking', P, 'hand'));
  assert.notStrictEqual(got.origin, at);
});

test('journey: hand picks up a walker, play re-picks it in a topple, a cancel resumes the walk', () => {
  let s = next(INITIAL, { type: 'walk' });
  s = next(s, { type: 'pickUp', at: P, by: 'hand' });
  s = next(s, { type: 'pickUp', at: O, by: 'play' });
  assert.deepStrictEqual(s, H('walking', P, 'play'));
  assert.deepStrictEqual(next(s, { type: 'putDown', placed: false }), F('walking'));
});

test('journey: hand picks up a walker, hands it to play, play lands it placed: free and still', () => {
  let s = next(INITIAL, { type: 'walk' });
  s = next(s, { type: 'pickUp', at: P, by: 'hand' });
  s = next(s, { type: 'handOver', to: 'play' });
  assert.deepStrictEqual(s, H('walking', P, 'play'));
  assert.deepStrictEqual(next(s, { type: 'putDown', placed: true }), F('still'));
});

test('journey: walk, stop, resume returns to walking', () => {
  let s = next(INITIAL, { type: 'walk' });
  s = next(s, { type: 'stop' });
  s = next(s, { type: 'resume' });
  assert.deepStrictEqual(s, F('walking'));
});
