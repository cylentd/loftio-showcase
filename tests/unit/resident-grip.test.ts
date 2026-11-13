import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NONE, next } from '../../src/resident-grip.ts';
import type { Grip, GripEvent } from '../../src/resident-grip.ts';

// The item is opaque to the model: whatever the view wants to carry along. Two distinct ones, so a transition that
// keeps the old item where it should take the event's (or the reverse) fails.
type Item = Readonly<{ name: string }>;
const FIRST_ITEM: Item = Object.freeze({ name: 'a' });
const SECOND_ITEM: Item = Object.freeze({ name: 'b' });
const PRIMARY_POINTER = 1; // the pointer that holds the grip
const OTHER_POINTER = 2; // any other pointer

const PRESSED: Grip<Item> = Object.freeze({ kind: 'pressed', pointer: PRIMARY_POINTER, item: FIRST_ITEM });
const BY_POINTER: Grip<Item> = Object.freeze({ kind: 'carried', pointer: PRIMARY_POINTER, caught: false, item: FIRST_ITEM });
const BY_KEY: Grip<Item> = Object.freeze({ kind: 'carried', pointer: null, caught: true, item: FIRST_ITEM });

const FROM: readonly { name: string; grip: Grip<Item> }[] = [
  { name: 'none', grip: NONE },
  { name: 'pressed', grip: PRESSED },
  { name: 'carried by pointer', grip: BY_POINTER },
  { name: 'carried by key', grip: BY_KEY },
];

// One row per event; `to` has one cell per FROM state, in that order. null means refused: the same object comes back.
const TABLE: readonly { name: string; event: GripEvent<Item>; to: readonly (Grip<Item> | null)[] }[] = [
  { name: 'press', event: { type: 'press', pointer: OTHER_POINTER, caught: false, item: SECOND_ITEM },
    to: [{ kind: 'pressed', pointer: OTHER_POINTER, item: SECOND_ITEM }, null, null, null] },
  { name: 'press, caught from play', event: { type: 'press', pointer: OTHER_POINTER, caught: true, item: SECOND_ITEM },
    to: [{ kind: 'carried', pointer: OTHER_POINTER, caught: true, item: SECOND_ITEM }, null, null, null] },
  { name: 'drag by the holding pointer', event: { type: 'drag', pointer: PRIMARY_POINTER },
    to: [null, { kind: 'carried', pointer: PRIMARY_POINTER, caught: false, item: FIRST_ITEM }, null, null] },
  { name: 'drag by another pointer', event: { type: 'drag', pointer: OTHER_POINTER },
    to: [null, null, null, null] },
  { name: 'key', event: { type: 'key', caught: false, item: SECOND_ITEM },
    to: [{ kind: 'carried', pointer: null, caught: false, item: SECOND_ITEM }, null, null, null] },
  { name: 'key, caught from play', event: { type: 'key', caught: true, item: SECOND_ITEM },
    to: [{ kind: 'carried', pointer: null, caught: true, item: SECOND_ITEM }, null, null, null] },
  { name: 'end', event: { type: 'end' },
    to: [null, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }] },
];

const CELLS = TABLE.flatMap((row) => FROM.map((from, index) => ({ row, from, want: row.to[index] as Grip<Item> | null })));

test('every event row has one cell per from-state', () => {
  assert.deepStrictEqual(TABLE.map((row) => row.to.length), TABLE.map(() => FROM.length));
});

for (const { row, from, want } of CELLS.filter((cell) => cell.want !== null)) {
  test(`${row.name}: ${from.name} -> ${JSON.stringify(want)}`, () => {
    assert.deepStrictEqual(next(from.grip, Object.freeze(row.event)), want);
  });
}

for (const { row, from } of CELLS.filter((cell) => cell.want === null)) {
  test(`${row.name}: ${from.name} is refused with the same object`, () => {
    assert.strictEqual(next(from.grip, Object.freeze(row.event)), from.grip);
  });
}

test('end always gives the one NONE object, so a view can compare by identity', () => {
  assert.strictEqual(next(BY_POINTER, { type: 'end' }), NONE);
});

test('journey: press, drag, end, then a key pick-up starts a fresh grip', () => {
  let grip: Grip<Item> = next(NONE, { type: 'press', pointer: PRIMARY_POINTER, caught: false, item: FIRST_ITEM });
  grip = next(grip, { type: 'drag', pointer: PRIMARY_POINTER });
  grip = next(grip, { type: 'end' });
  grip = next(grip, { type: 'key', caught: false, item: SECOND_ITEM });
  assert.deepStrictEqual(grip, { kind: 'carried', pointer: null, caught: false, item: SECOND_ITEM });
});
