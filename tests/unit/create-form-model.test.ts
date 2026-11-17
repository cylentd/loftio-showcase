import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL, next, timerOf } from '../../src/residents/create-form-model.ts';
import type { FormEvent, FormState } from '../../src/residents/create-form-model.ts';

// The Create panel's lifecycle as a table of event x state. Literal states hold no rule.
// null means refused: the very same object comes back.
const C: FormState = { kind: 'choosing' };
const H = (hold: 'pick' | 'roll' | 'forMe'): FormState => ({ kind: 'holding', hold });
const U: FormState = { kind: 'unarmed' };
const A: FormState = { kind: 'armed' };
const X: FormState = { kind: 'creating' };
const R: FormState = { kind: 'arrived' };
const D: FormState = { kind: 'disposed' };

const COLUMNS: readonly [string, () => FormState][] = [
  ['choosing', () => ({ ...C })], ['holding pick', () => ({ ...H('pick') })], ['holding roll', () => ({ ...H('roll') })],
  ['unarmed', () => ({ ...U })], ['armed', () => ({ ...A })], ['creating', () => ({ ...X })],
  ['arrived', () => ({ ...R })], ['disposed', () => ({ ...D })],
];

type Expect = FormState | null;
const ROWS: readonly { event: FormEvent; out: readonly Expect[] }[] = [
  { event: { type: 'hold', hold: 'pick' }, out: [H('pick'), null, null, null, null, null, null, null] },
  { event: { type: 'hold', hold: 'forMe' }, out: [H('forMe'), null, null, null, null, null, null, null] },
  { event: { type: 'holdDone' }, out: [null, C, C, null, null, null, null, null] },
  { event: { type: 'show' }, out: [C, C, C, C, C, null, null, null] },
  { event: { type: 'submit' }, out: [U, null, null, null, null, null, null, null] },
  { event: { type: 'armed' }, out: [null, null, null, A, null, null, null, null] },
  { event: { type: 'no' }, out: [null, null, null, C, C, null, null, null] },
  { event: { type: 'yes' }, out: [null, null, null, null, C, null, null, null] },
  { event: { type: 'busy', generating: false }, out: [X, X, X, X, X, null, null, null] },
  { event: { type: 'busy', generating: true }, out: [X, X, X, X, X, null, X, null] },
  { event: { type: 'idle' }, out: [null, null, null, null, null, C, null, null] },
  { event: { type: 'finish', notice: true }, out: [R, R, R, R, R, R, R, null] },
  { event: { type: 'finish', notice: false }, out: [C, C, C, C, C, C, C, null] },
  { event: { type: 'dismiss' }, out: [null, null, null, null, null, null, C, null] },
  { event: { type: 'dispose' }, out: [D, D, D, D, D, D, D, null] },
];

const payload = (event: FormEvent) => JSON.stringify(event).replace(/[{}"]/g, '');
const CASES = ROWS.flatMap(({ event, out }) => COLUMNS.map(([name, make], column) =>
  ({ label: `${payload(event)} from ${name}`, make, event, expected: out[column]! })));

for (const { label, make, event } of CASES.filter(item => item.expected === null)) {
  test(`create form: ${label} is refused`, () => {
    const from = make();
    assert.equal(next(from, event), from, 'a refused event returns the same object');
  });
}

for (const { label, make, event, expected } of CASES.filter(item => item.expected !== null)) {
  test(`create form: ${label} is accepted`, () => {
    assert.deepEqual(next(make(), event), expected);
  });
}

test('create form: the start state is choosing', () => {
  assert.deepEqual(INITIAL, { kind: 'choosing' });
});

test('create form: an unknown event is refused by identity', () => {
  const from = { ...C };
  assert.equal(next(from, { type: 'bogus' } as unknown as FormEvent), from);
});

for (const [state, timer] of [[C, null], [H('pick'), 'hold'], [H('roll'), 'hold'], [U, 'arm'], [A, null], [X, null], [R, null], [D, null]] as const) {
  test(`create form: timerOf ${state.kind}${'hold' in state ? ' ' + state.hold : ''} is ${timer}`, () => {
    assert.equal(timerOf(state), timer);
  });
}

test('create form: a stale hold cannot finish after a build starts', () => {
  const picking = next(INITIAL, { type: 'hold', hold: 'pick' });
  const creating = next(picking, { type: 'busy', generating: true });
  assert.equal(next(creating, { type: 'holdDone' }), creating);
});

test('create form: a full journey from question to arrival and back', () => {
  const steps: [FormEvent, string][] = [
    [{ type: 'hold', hold: 'pick' }, 'holding'], [{ type: 'holdDone' }, 'choosing'], [{ type: 'submit' }, 'unarmed'],
    [{ type: 'armed' }, 'armed'], [{ type: 'yes' }, 'choosing'], [{ type: 'busy', generating: true }, 'creating'],
    [{ type: 'finish', notice: true }, 'arrived'], [{ type: 'dismiss' }, 'choosing'],
  ];
  const kinds = steps.map(([event]) => event).reduce<FormState[]>((seen, event) => [...seen, next(seen.at(-1)!, event)], [INITIAL]).slice(1).map(state => state.kind);
  assert.deepEqual(kinds, steps.map(([, kind]) => kind));
});
