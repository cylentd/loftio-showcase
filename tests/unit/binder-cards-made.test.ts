// A kept record feeds the binder through the card's art, so the binder shows a made resident's card (G4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binderCards, cardSourceFor } from '../../src/binder/binder-cards-model.ts';
import { holoForResident } from '../../src/holo-card/holo-pool-model.ts';

const ART = { idle: 'idle.webp', expression: 'expr.webp', alt: 'alt.webp' };
const cards = (record: Parameters<typeof cardSourceFor>[0]) =>
  binderCards({ originals: [], kept: [cardSourceFor(record, ART, 'Bean')], loft: new Set() }, holoForResident);

test('a kept record with no alt is a made card with its idle as the normal art', () => {
  const [card] = cards({ id: 'k1' });
  assert.deepEqual([card!.kind, card!.name, card!.art], ['made', 'Bean', { normal: 'idle.webp' }]);
});

test('a kept record with a ready alt shows the alt art', () => {
  const [card] = cards({ id: 'k1', alt: { slot: { status: 'ready' } } });
  assert.deepEqual(card!.art, { normal: 'idle.webp', alt: 'alt.webp' });
});

for (const status of ['pending', 'failed'] as const) {
  test(`a kept record whose alt is ${status} shows no alt`, () => {
    const [card] = cards({ id: 'k1', alt: { slot: { status } } });
    assert.equal(card!.art.alt, undefined);
  });
}
