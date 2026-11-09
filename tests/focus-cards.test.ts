import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FOCUS_CARD_IDS, MAX_FOCUS_CARDS, focusCards } from '../src/focus/cards.ts';
import { FOCUS_COPY } from '../src/focus/copy.ts';

const KEY = 'focus-test';

function memory(initial?: string) {
  const items = new Map<string, string>(initial === undefined ? [] : [[KEY, initial]]);
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); } };
}

test('there are eight cards, in the order LOFTIO-COMPANION.md lists them, and up to three can be picked', () => {
  assert.deepEqual(FOCUS_CARD_IDS, ['move', 'outside', 'tidy', 'organize', 'rest', 'people', 'make', 'wishlist']);
  assert.equal(MAX_FOCUS_CARDS, 3);
  assert.deepEqual(FOCUS_CARD_IDS.map(id => FOCUS_COPY.cards[id].label),
    ['Move', 'Get outside', 'Tidy', 'Organize', 'Rest', 'People', 'Make & learn', 'Wishlist']);
});

test('a first visit has nothing picked and has not answered yet', () => {
  const cards = focusCards(memory(), KEY);
  assert.deepEqual(cards.chosen(), []);
  assert.equal(cards.answered(), false);
  assert.equal(cards.full(), false);
});

test('a tap picks a card, in tap order, and a fourth pick is refused without changing the three', () => {
  const cards = focusCards(memory(), KEY);
  assert.equal(cards.toggle('rest'), true);
  assert.equal(cards.toggle('move'), true);
  assert.equal(cards.toggle('people'), true);
  assert.equal(cards.full(), true);
  assert.equal(cards.toggle('tidy'), false);
  assert.deepEqual(cards.chosen(), ['rest', 'move', 'people']);
});

test('tapping a picked card puts it back, which frees a slot', () => {
  const cards = focusCards(memory(), KEY);
  cards.toggle('rest'); cards.toggle('move'); cards.toggle('people');
  assert.equal(cards.toggle('move'), true);
  assert.deepEqual(cards.chosen(), ['rest', 'people']);
  assert.equal(cards.toggle('tidy'), true);
  assert.deepEqual(cards.chosen(), ['rest', 'people', 'tidy']);
});

test('skip answers the question with no cards, and the answer survives a reload', () => {
  const storage = memory();
  focusCards(storage, KEY).finish();
  const later = focusCards(storage, KEY);
  assert.equal(later.answered(), true);
  assert.deepEqual(later.chosen(), []);
});

test('done keeps the picks, and they survive a reload', () => {
  const storage = memory();
  const cards = focusCards(storage, KEY);
  cards.toggle('outside'); cards.toggle('make'); cards.finish();
  const later = focusCards(storage, KEY);
  assert.equal(later.answered(), true);
  assert.deepEqual(later.chosen(), ['outside', 'make']);
});

test('picks stay changeable after the first answer, and changing them never re-asks', () => {
  const storage = memory();
  const cards = focusCards(storage, KEY);
  cards.toggle('tidy'); cards.finish();
  cards.toggle('tidy'); cards.toggle('wishlist');
  const later = focusCards(storage, KEY);
  assert.deepEqual(later.chosen(), ['wishlist']);
  assert.equal(later.answered(), true);
});

test('the saved record holds only card ids: no resident is assigned to a card', () => {
  const storage = memory();
  const cards = focusCards(storage, KEY);
  cards.toggle('move'); cards.toggle('people'); cards.finish();
  const saved = JSON.parse(storage.items.get(KEY)!);
  assert.deepEqual(saved, { version: 1, cards: ['move', 'people'], answered: true });
});

test('every call re-reads storage, so a pick in another tab shows here at once', () => {
  const storage = memory();
  const here = focusCards(storage, KEY); const there = focusCards(storage, KEY);
  there.toggle('rest'); there.finish();
  assert.deepEqual(here.chosen(), ['rest']);
  assert.equal(here.answered(), true);
});

test('a damaged record keeps what it can: known cards, once each, at most three', () => {
  const storage = memory(JSON.stringify({ version: 1, cards: ['move', 'gone', 'move', 'rest', 'tidy', 'people', 7], answered: true }));
  const cards = focusCards(storage, KEY);
  assert.deepEqual(cards.chosen(), ['move', 'rest', 'tidy']);
  assert.equal(cards.answered(), true);
});

for (const [name, raw] of [['unreadable', '{not json'], ['another version', JSON.stringify({ version: 2, cards: ['move'], answered: true })],
  ['a wrong shape', JSON.stringify(['move'])]] as const) {
  test(`a record that is ${name} starts fresh instead of breaking the room`, () => {
    const cards = focusCards(memory(raw), KEY);
    assert.deepEqual(cards.chosen(), []);
    assert.equal(cards.answered(), false);
  });
}

test('an unknown card id is refused and changes nothing', () => {
  const storage = memory();
  const cards = focusCards(storage, KEY);
  assert.equal(cards.toggle('nap' as never), false);
  assert.equal(storage.items.has(KEY), false);
});

test('every card has a label and one tiny thing to try', () => {
  for (const id of FOCUS_CARD_IDS) {
    const card = FOCUS_COPY.cards[id];
    assert.ok(card.label.length > 0 && card.tiny.length > 0, id);
  }
});
