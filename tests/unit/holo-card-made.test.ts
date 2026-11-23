// A made resident's card subject comes from its saved record (G4): which follow-ups show, the look, the element.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardSubjectFor, type MadeRecord } from '../../src/holo-card/holo-card-made-model.ts';
import { ELEMENTS } from '../../src/holo-card/holo-card-model.ts';
import { holoFor } from '../../src/holo-card/holo-pool-model.ts';
import type { CardSubject } from '../../src/holo-card/holo-card-subject.ts';

const ART = { idle: 'idle.webp', expression: 'expr.webp', alt: 'alt.webp' };
export const asCardSubject = (subject: ReturnType<typeof cardSubjectFor>): CardSubject => subject; // typecheck: a made subject is a CardSubject
const record = (extra: Partial<MadeRecord> = {}): MadeRecord => ({ id: 'made-1', ...extra });

test('a record with nothing ready is the idle alone, on the normal card', () => {
  const subject = cardSubjectFor(record(), ART, 'Bean');
  assert.deepEqual([subject.name, subject.idle, subject.expression, subject.alt], ['Bean', 'idle.webp', undefined, undefined]);
  assert.equal(subject.look, 'classic');
});

test('a ready expression is included', () => {
  const subject = cardSubjectFor(record({ expression: { status: 'ready' } }), ART, 'Bean');
  assert.equal(subject.expression, 'expr.webp');
});

test('a ready alt is included and the card wears its seeded look', () => {
  const subject = cardSubjectFor(record({ alt: { slot: { status: 'ready' } } }), ART, 'Bean');
  assert.equal(subject.alt, 'alt.webp');
  assert.equal(subject.look, holoFor('made-1', 'alt'));
});

for (const status of ['pending', 'failed'] as const) {
  test(`a ${status} alt and a ${status} expression are left out`, () => {
    const subject = cardSubjectFor(record({ expression: { status }, alt: { slot: { status } } }), ART, 'Bean');
    assert.deepEqual([subject.expression, subject.alt, subject.look], [undefined, undefined, 'classic']);
  });
}

test('a ready slot whose art did not resolve is left out', () => {
  const subject = cardSubjectFor(record({ alt: { slot: { status: 'ready' } } }), { idle: 'idle.webp' }, 'Bean');
  assert.equal(subject.alt, undefined);
});

test('the same id always gives the same look and element', () => {
  const ready = { alt: { slot: { status: 'ready' } } } as const;
  const first = cardSubjectFor(record(ready), ART, 'A'), second = cardSubjectFor(record(ready), ART, 'B');
  assert.deepEqual([first.look, first.element], [second.look, second.element]);
  assert.ok(ELEMENTS.includes(first.element));
});

test('a stored element wins over the seeded pick', () => {
  const stored = ELEMENTS.find(element => element !== cardSubjectFor(record(), ART, 'A').element)!;
  assert.equal(cardSubjectFor(record({ rumble: { element: stored } }), ART, 'A').element, stored);
});
