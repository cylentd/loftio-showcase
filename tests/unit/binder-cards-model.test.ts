// Card facts for the binder: originals and kept records become BinderCards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { binderCards, type CardSource } from '../../src/binder/binder-cards-model.ts';

const source = (id: string, alt?: CardSource['alt']): CardSource =>
  ({ id, name: `Name ${id}`, image: `${id}.webp`, ...(alt ? { alt } : {}) });
const lookOf = (id: string) => (id === 'o1' ? 'rainbow' : 'cosmos') as 'rainbow' | 'cosmos';
const make = (originals: CardSource[], kept: CardSource[], loft: string[] = []) =>
  binderCards({ originals, kept, loft: new Set(loft) }, lookOf);

test('originals come first, then kept records in the order given', () => {
  const cards = make([source('o1'), source('o2')], [source('k1'), source('k2')]);
  assert.deepEqual(cards.map(card => [card.id, card.kind]), [['o1', 'original'], ['o2', 'original'], ['k1', 'made'], ['k2', 'made']]);
});

test('a card carries its name, its normal art and whether it is in the loft', () => {
  const [home, away] = make([source('o1'), source('o2')], [], ['o1']);
  assert.deepEqual([home!.name, home!.art.normal, home!.inLoft], ['Name o1', 'o1.webp', true]);
  assert.equal(away!.inLoft, false);
});

test('the look comes from the injected look function', () => {
  const [first, second] = make([source('o1'), source('o2')], []);
  assert.deepEqual([first!.look, second!.look], ['rainbow', 'cosmos']);
});

for (const status of ['none', 'pending', 'failed'] as const) {
  test(`an alt whose slot is ${status} is not shown`, () => {
    const [card] = make([], [source('k1', { slot: { status, image: 'k1-alt.webp' } })]);
    assert.equal(card!.art.alt, undefined);
  });
}

test('an alt whose slot is ready shows its image', () => {
  const [card] = make([], [source('k1', { slot: { status: 'ready', image: 'k1-alt.webp' } })]);
  assert.equal(card!.art.alt, 'k1-alt.webp');
});

test('a ready alt with no image is not shown', () => {
  const [card] = make([], [source('k1', { slot: { status: 'ready' } })]);
  assert.equal(card!.art.alt, undefined);
});
