import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLO_TABS, HOLO_TYPES, MIX_TAB } from '../../src/holo-card/holo-type-data.ts';
import { boardStep, cardHolos, initialBoard, BOARD_CARDS } from '../../src/holo-card/holo-compare-model.ts';

const holoIds = HOLO_TYPES.map(type => type.id);

test('every tab but Mix names a holo in the data table, and every holo has a tab', () => {
  const single = HOLO_TABS.filter(tab => tab !== MIX_TAB);
  assert.deepEqual([...single].sort(), [...holoIds].sort());
});

for (const tab of HOLO_TABS.filter(t => t !== MIX_TAB)) {
  test(`the ${tab} tab puts ${tab} on all three cards`, () => {
    assert.deepEqual(cardHolos(tab), BOARD_CARDS.map(() => tab));
  });
}

test('Mix gives the three cards three different holos from the data table', () => {
  const holos = cardHolos(MIX_TAB);
  assert.equal(new Set(holos).size, BOARD_CARDS.length);
  assert.ok(holos.every(id => holoIds.includes(id)));
});

test('the board opens on the first tab, animating unless motion is reduced', () => {
  assert.deepEqual(initialBoard(false), { tab: HOLO_TABS[0], animate: true });
  assert.deepEqual(initialBoard(true), { tab: HOLO_TABS[0], animate: false });
});

test('picking a tab changes only the tab and leaves the old state untouched', () => {
  const before = initialBoard(false);
  const after = boardStep(before, { kind: 'tab', tab: MIX_TAB }, false);
  assert.deepEqual(after, { tab: MIX_TAB, animate: true });
  assert.deepEqual(before, { tab: HOLO_TABS[0], animate: true });
});

test('the toggle flips animation, and reduced motion holds it off', () => {
  const on = initialBoard(false);
  assert.equal(boardStep(on, { kind: 'toggle' }, false).animate, false);
  assert.equal(boardStep(boardStep(on, { kind: 'toggle' }, false), { kind: 'toggle' }, false).animate, true);
  assert.equal(boardStep(initialBoard(true), { kind: 'toggle' }, true).animate, false);
});

test('an unknown tab is ignored', () => {
  const before = initialBoard(false);
  assert.deepEqual(boardStep(before, { kind: 'tab', tab: 'sparkly' }, false), before);
});
