import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RESTING, next } from '../../src/glade/departure-model.ts';
import type { Departure, DepartureEvent } from '../../src/glade/departure-model.ts';

// The departure lifecycle: resting, leaving (cover up, animation running), navigated (location.assign sent).
// `epoch` counts departures, so a completion from an earlier one is told apart from the current one.
const LEAVING_1: Departure = { kind: 'leaving', epoch: 1 };
const NAVIGATED_1: Departure = { kind: 'navigated', epoch: 1 };
const RESTING_1: Departure = { kind: 'resting', epoch: 1 };

const FROM: readonly { name: string; state: Departure }[] = [
  { name: 'resting, epoch 0', state: RESTING },
  { name: 'resting, epoch 1', state: RESTING_1 },
  { name: 'leaving, epoch 1', state: LEAVING_1 },
  { name: 'navigated, epoch 1', state: NAVIGATED_1 },
];

// One row per event; `to` has one cell per FROM state, in that order. null means refused: the same object comes back.
const TABLE: readonly { name: string; event: DepartureEvent; to: readonly (Departure | null)[] }[] = [
  { name: 'click', event: { type: 'click' },
    to: [{ kind: 'leaving', epoch: 1 }, { kind: 'leaving', epoch: 2 }, null, null] },
  { name: 'finished, current epoch', event: { type: 'finished', epoch: 1 },
    to: [null, null, NAVIGATED_1, null] },
  { name: 'finished, stale epoch', event: { type: 'finished', epoch: 0 },
    to: [null, null, null, null] },
  { name: 'pageshow', event: { type: 'pageshow' },
    to: [null, null, RESTING_1, RESTING_1] },
];

const CELLS = TABLE.flatMap((row) => FROM.map((from, index) => ({ row, from, want: row.to[index] as Departure | null })));

test('every event row has one cell per from-state', () => {
  assert.deepStrictEqual(TABLE.map((row) => row.to.length), TABLE.map(() => FROM.length));
});

for (const { row, from, want } of CELLS.filter((cell) => cell.want !== null)) {
  test(`${row.name}: ${from.name} -> ${JSON.stringify(want)}`, () => {
    assert.deepStrictEqual(next(from.state, Object.freeze(row.event)), want);
  });
}

for (const { row, from } of CELLS.filter((cell) => cell.want === null)) {
  test(`${row.name}: ${from.name} is refused with the same object`, () => {
    assert.strictEqual(next(from.state, Object.freeze(row.event)), from.state);
  });
}

test('an unknown event is refused', () => {
  assert.strictEqual(next(LEAVING_1, { type: 'nonsense' } as unknown as DepartureEvent), LEAVING_1);
});

test('a completion from before a pageshow cannot finish the departure that follows it', () => {
  const first = next(RESTING, { type: 'click' });
  const reset = next(first, { type: 'pageshow' });
  const second = next(reset, { type: 'click' });
  assert.strictEqual(next(second, { type: 'finished', epoch: 1 }), second);
  assert.deepStrictEqual(next(second, { type: 'finished', epoch: 2 }), { kind: 'navigated', epoch: 2 });
});
