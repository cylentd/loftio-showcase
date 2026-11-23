import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_RESIDENTS } from '../../src/holo-card/holo-card-model.ts';
import { BINDER } from '../../src/binder/constants.ts';
import {
  applyAction, binderPages, sheetActions, turnView, viewCount, viewOfPage, viewPages,
} from '../../src/binder/binder-model.ts';

const pages = binderPages(CARD_RESIDENTS, BINDER.perPage, BINDER.minPages);

test('the six cards fill the first pockets in lineup order, the rest are empty pockets', () => {
  const ids = pages.flat().filter(slot => slot.kind === 'card').map(slot => slot.id);
  assert.deepEqual(ids, [...CARD_RESIDENTS]);
  assert.ok(pages.every(page => page.length === BINDER.perPage));
  assert.equal(pages.flat().findIndex(slot => slot.kind === 'empty'), CARD_RESIDENTS.length);
});

test('the binder holds at least its minimum pages, and grows a page when the cards overflow', () => {
  assert.equal(pages.length, BINDER.minPages);
  const many = Array.from({ length: BINDER.perPage * BINDER.minPages + 1 }, (_, index) => `r${index}`);
  assert.equal(binderPages(many, BINDER.perPage, BINDER.minPages).length, BINDER.minPages + 1);
});

test('turning clamps at the first and last view', () => {
  const count = viewCount(pages.length, 1);
  assert.equal(turnView(0, -1, count), 0);
  assert.equal(turnView(0, 1, count), 1);
  assert.equal(turnView(count - 1, 1, count), count - 1);
});

test('a two-page spread pairs the pages and ends on a blank endpaper when the count is odd', () => {
  assert.equal(viewCount(3, 2), 2);
  assert.deepEqual(viewPages(0, 2, 3), [0, 1]);
  assert.deepEqual(viewPages(1, 2, 3), [2, null]);
});

test('switching between one page and a spread keeps the first visible page in view', () => {
  assert.equal(viewOfPage(2, 2), 1);
  assert.equal(viewOfPage(1, 1), 1);
});

test('the sheet offers Send home for a resident in the loft and Invite in for one away, first', () => {
  assert.equal(sheetActions(true)[0], 'home');
  assert.equal(sheetActions(false)[0], 'invite');
});

test('Send home and Invite in flip the loft mark', () => {
  const loft = new Set(['sprout']);
  assert.equal(applyAction(loft, 'sprout', 'home').has('sprout'), false);
  assert.equal(applyAction(loft, 'puff', 'invite').has('puff'), true);
  assert.equal(loft.has('sprout'), true, 'the old set is untouched');
});

for (const action of ['invitation', 'abilities', 'reroll'] as const) {
  test(`${action} leaves the loft mark as it was`, () => {
    assert.deepEqual([...applyAction(new Set(['sprout']), 'sprout', action)], ['sprout']);
  });
}
