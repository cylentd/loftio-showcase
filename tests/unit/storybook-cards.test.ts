import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORIGINAL_SIDES } from '../../src/binder/constants.ts';
import { CARD_RESIDENTS } from '../../src/holo-card/holo-card-model.ts';
import { packPages, storybookCards } from '../../src/storybook/pages.ts';
import { STORYBOOK } from '../../src/storybook/constants.ts';

// Unit layer (#565 S4, LFT-088): the storybook's cards are one flat list, packed into 3x3 pages in list order, and
// the pages into spreads of one (phone) or two (desktop). Owner, 2026-11-21: "smaller cards. im thinking 3x3".

const list = (n: number) => Array.from({ length: n }, (_, i) => i);
const slots = STORYBOOK.slotsPerPage;

const PACKING: [string, number, number, number[], (number | null)[][]][] = [
  ['18 cards fill two pages, one desktop spread', 18, 2, [9, 9], [[0, 1]]],
  ['9 cards fill one page; the spread pads its right side', 9, 2, [9], [[0, null]]],
  ['10 cards spill one card onto a second page', 10, 1, [9, 1], [[0], [1]]],
  ['0 cards make no page and no spread', 0, 2, [], []],
  ['27 cards make three pages, two desktop spreads', 27, 2, [9, 9, 9], [[0, 1], [2, null]]],
];

for (const [name, count, perView, sizes, spreads] of PACKING) {
  test(`packPages: ${name}`, () => {
    const packed = packPages(list(count), slots, perView);
    assert.deepEqual([packed.pages.map(page => page.length), packed.spreads], [sizes, spreads]);
  });
}

test('packPages keeps list order across pages', () => {
  assert.deepEqual(packPages(list(10), slots, 1).pages.flat(), list(10));
});

test('the card list is each original in card order with its standard, cozy and action card; only the first is named', () => {
  const cards = storybookCards();
  const expected = CARD_RESIDENTS.flatMap(id => ORIGINAL_SIDES.map((side, i) => [id, side.key, i === 0]));
  assert.deepEqual(cards.map(card => [card.id, card.side, card.named]), expected);
});
