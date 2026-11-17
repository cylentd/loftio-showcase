import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ASKING, DONE, IDLE, WAITING, next } from '../../src/focus/ask-model.ts';
import type { AskEvent, AskState } from '../../src/focus/ask-model.ts';

// The first-ask lifecycle: idle (nothing scheduled), waiting (one timer pending), asking (the picker is open), done.
const FROM: readonly { name: string; state: AskState }[] = [
  { name: 'idle', state: IDLE },
  { name: 'waiting', state: WAITING },
  { name: 'asking', state: ASKING },
  { name: 'done', state: DONE },
];

// One row per event; `to` has one cell per FROM state, in that order. null means refused: the same object comes back.
const TABLE: readonly { name: string; event: AskEvent; to: readonly (AskState | null)[] }[] = [
  { name: 'askOnce, not answered', event: { type: 'askOnce', answered: false }, to: [WAITING, null, null, null] },
  { name: 'askOnce, already answered', event: { type: 'askOnce', answered: true }, to: [DONE, null, null, null] },
  { name: 'tick, free', event: { type: 'tick', answered: false, busy: false }, to: [null, ASKING, null, null] },
  { name: 'tick, another panel open', event: { type: 'tick', answered: false, busy: true }, to: [null, WAITING, null, null] },
  { name: 'tick, answered meanwhile', event: { type: 'tick', answered: true, busy: false }, to: [null, DONE, null, null] },
  { name: 'tick, answered and busy', event: { type: 'tick', answered: true, busy: true }, to: [null, DONE, null, null] },
  { name: 'answered', event: { type: 'answered' }, to: [DONE, DONE, DONE, null] },
  { name: 'dispose', event: { type: 'dispose' }, to: [DONE, DONE, DONE, null] },
];

const CELLS = TABLE.flatMap((row) => FROM.map((from, index) => ({ row, from, want: row.to[index] as AskState | null })));

test('every event row has one cell per from-state', () => {
  assert.deepStrictEqual(TABLE.map((row) => row.to.length), TABLE.map(() => FROM.length));
});

for (const { row, from, want } of CELLS.filter((cell) => cell.want !== null)) {
  test(`${row.name}: ${from.name} -> ${want?.kind}`, () => {
    assert.deepStrictEqual(next(from.state, Object.freeze(row.event)), want);
  });
}

for (const { row, from } of CELLS.filter((cell) => cell.want === null)) {
  test(`${row.name}: ${from.name} is refused with the same object`, () => {
    assert.strictEqual(next(from.state, Object.freeze(row.event)), from.state);
  });
}

test('an unknown event is refused', () => {
  assert.strictEqual(next(WAITING, { type: 'nonsense' } as unknown as AskEvent), WAITING);
});

test('a second askOnce while waiting is refused, so one timer is ever scheduled', () => {
  const first = next(IDLE, { type: 'askOnce', answered: false });
  assert.strictEqual(next(first, { type: 'askOnce', answered: false }), first);
});
