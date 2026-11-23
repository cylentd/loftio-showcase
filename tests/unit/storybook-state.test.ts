import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextStorybook, type StorybookEvent, type StorybookState } from '../../src/storybook/state.ts';
import { spreadCount, spreadPages } from '../../src/storybook/pages.ts';

// Unit layer: G15, the storybook page (#565). Rules: TODO.md "Storybook page for the holo cards", State bullet.

const closed: StorybookState = { kind: 'closed' };
const opening: StorybookState = { kind: 'opening' };
const open = (spread: number, zoom: string | null = null): StorybookState => ({ kind: 'open', spread, zoom });
const turning = (from: number, to: number): StorybookState => ({ kind: 'turning', from, to });
const closing = (spread: number): StorybookState => ({ kind: 'closing', spread });
const turn = (dir: 1 | -1, count = 3): StorybookEvent => ({ type: 'turn', dir, spreadCount: count });
const resize = (was: number, perView: number): StorybookEvent => ({ type: 'resize', was, perView, pages: 6 });

const MOVES: [string, StorybookState, StorybookEvent, StorybookState][] = [
  ['open from closed starts opening', closed, { type: 'open' }, opening],
  ['opened lands on the first spread', opening, { type: 'opened' }, open(0)],
  ['turn forward starts a turn', open(0), turn(1), turning(0, 1)],
  ['turn back starts a turn', open(2), turn(-1), turning(2, 1)],
  ['turned lands on the new spread', turning(0, 1), { type: 'turned' }, open(1)],
  ['zoom opens a big card', open(1), { type: 'zoom', id: 'slime' }, open(1, 'slime')],
  ['unzoom closes the big card', open(1, 'slime'), { type: 'unzoom' }, open(1)],
  ['close from an open spread starts closing', open(2), { type: 'close' }, closing(2)],
  ['close while opening starts closing', opening, { type: 'close' }, closing(0)],
  ['close mid-turn starts closing on the target', turning(0, 1), { type: 'close' }, closing(1)],
  ['closed ends closing', closing(1), { type: 'closed' }, closed],
  ['resize to one page keeps the first resident in view', open(1), resize(2, 1), open(2)],
  ['resize to a spread keeps the first resident in view', open(3), resize(1, 2), open(1)],
  ['resize keeps the zoom', open(5, 'chomper'), resize(1, 2), open(2, 'chomper')],
];

const REFUSED: [string, StorybookState, StorybookEvent][] = [
  ['open while opening', opening, { type: 'open' }],
  ['open while open', open(0), { type: 'open' }],
  ['open while turning', turning(0, 1), { type: 'open' }],
  ['open while closing', closing(0), { type: 'open' }],
  ['turn while closed', closed, turn(1)],
  ['turn while opening', opening, turn(1)],
  ['turn while turning', turning(0, 1), turn(1)],
  ['turn while closing', closing(1), turn(1)],
  ['turn while zoomed', open(1, 'slime'), turn(1)],
  ['turn back past the first spread', open(0), turn(-1)],
  ['turn past the last spread', open(2), turn(1)],
  ['zoom while closed', closed, { type: 'zoom', id: 'puff' }],
  ['zoom while opening', opening, { type: 'zoom', id: 'puff' }],
  ['zoom while turning', turning(0, 1), { type: 'zoom', id: 'puff' }],
  ['zoom while closing', closing(0), { type: 'zoom', id: 'puff' }],
  ['zoom while zoomed', open(0, 'sprout'), { type: 'zoom', id: 'puff' }],
  ['unzoom with no big card', open(0), { type: 'unzoom' }],
  ['close while zoomed', open(0, 'sprout'), { type: 'close' }],
  ['close while closed', closed, { type: 'close' }],
  ['close while closing', closing(0), { type: 'close' }],
  ['opened after a close cut the opening', closing(0), { type: 'opened' }],
  ['turned after a close cut the turn', closing(1), { type: 'turned' }],
  ['turned while open', open(1), { type: 'turned' }],
  ['closed while open', open(1), { type: 'closed' }],
  ['resize mid-turn waits for turned', turning(0, 1), resize(2, 1)],
  ['resize while closed', closed, resize(2, 1)],
];

for (const [name, state, event, expected] of MOVES) {
  test(`G15: ${name}`, () => { assert.deepEqual(nextStorybook(state, event), expected); });
}

for (const [name, state, event] of REFUSED) {
  test(`G15 refuses ${name}: the same state comes back`, () => { assert.equal(nextStorybook(state, event), state); });
}

test('one page per view makes a spread per resident; two per view pair them', () => {
  assert.deepEqual([spreadCount(6, 1), spreadCount(6, 2), spreadCount(5, 2)], [6, 3, 3]);
});

test('a spread lists its pages, and a short last spread pads with null', () => {
  assert.deepEqual([spreadPages(1, 2, 6), spreadPages(4, 1, 6), spreadPages(2, 2, 5)], [[2, 3], [4], [4, null]]);
});
